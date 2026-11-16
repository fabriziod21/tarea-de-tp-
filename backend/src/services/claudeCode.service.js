// backend/src/services/claudeCode.service.js
//
// MODO "code": el cerebro del chatbot es TU Claude Code (con la sesión de tu
// cuenta de Claude), en lugar de la API con ANTHROPIC_API_KEY.
// El backend ejecuta `claude -p` en modo no interactivo y le da acceso SOLO a
// las herramientas del MCP Server (sin terminal ni archivos).
//
// ⚠ Solo para desarrollo / demo en tu PC: no se puede desplegar en Render y
//   Anthropic no permite usar una suscripción para una app que usen otras personas.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MCP_NAME = 'postgres-chatbot';
const TOOL_PREFIX = `mcp__${MCP_NAME}__`;
const TOOLS = [
  'list_tables',
  'describe_table',
  'get_relationships',
  'run_readonly_query',
  'consultar_reniec_dni',
  'consultar_sunat_ruc',
];
const MCP_ENTRY = path.resolve(__dirname, '../../../mcp-server/src/index.js');
const WORK_DIR = path.join(os.tmpdir(), 'chatbot-claude-code');
const TIMEOUT_MS = Number(process.env.CLAUDE_CODE_TIMEOUT_MS || 180000);

class ClaudeCodeError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'ClaudeCodeError';
    this.status = status;
  }
}

let cachedBinary;

/** Busca el ejecutable de Claude Code: CLAUDE_CODE_PATH, el PATH o la extensión de VS Code. */
function resolveClaudeBinary() {
  if (cachedBinary !== undefined) return cachedBinary;

  if (process.env.CLAUDE_CODE_PATH) {
    return (cachedBinary = process.env.CLAUDE_CODE_PATH);
  }

  try {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const found = execFileSync(finder, ['claude'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pick =
      process.platform === 'win32'
        ? found.find((p) => p.toLowerCase().endsWith('.exe')) || found.find((p) => p.toLowerCase().endsWith('.cmd'))
        : found[0];
    if (pick) return (cachedBinary = pick);
  } catch {
    // no está en el PATH
  }

  // Claude Code instalado como extensión de VS Code (trae su propio ejecutable)
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const editor of ['.vscode', '.vscode-insiders', '.cursor']) {
    const root = path.join(os.homedir(), editor, 'extensions');
    let dirs = [];
    try {
      dirs = fs.readdirSync(root).filter((d) => d.startsWith('anthropic.claude-code-'));
    } catch {
      continue;
    }
    dirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const dir of dirs) {
      const candidate = path.join(root, dir, 'resources', 'native-binary', exe);
      if (fs.existsSync(candidate)) return (cachedBinary = candidate);
    }
  }

  return (cachedBinary = null);
}

/** Prepara una carpeta vacía con la config del MCP Server y el system prompt. */
function prepareWorkDir(systemPrompt) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const mcpConfig = path.join(WORK_DIR, 'mcp.json');
  const promptFile = path.join(WORK_DIR, 'system-prompt.txt');
  fs.writeFileSync(
    mcpConfig,
    JSON.stringify({ mcpServers: { [MCP_NAME]: { command: process.execPath, args: [MCP_ENTRY] } } }, null, 2)
  );
  fs.writeFileSync(promptFile, systemPrompt);
  return { mcpConfig, promptFile };
}

function quoteForShell(arg) {
  if (arg === '') return '""';
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

const stripPrefix = (name) => String(name).replace(TOOL_PREFIX, '');

/**
 * Ejecuta una pregunta con Claude Code.
 * @param {object} opts
 * @param {string} opts.prompt        texto completo del turno (contexto RAG + pregunta)
 * @param {string} opts.systemPrompt
 * @param {(r: {id: string, tool: string, input: object, output: string, isError: boolean}) => void} [opts.onToolResult]
 * @param {(type: string, data: object) => void} [opts.onEvent]   streaming: delta | reset | tool_call
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ text: string, model: string|null, usage: object }>}
 */
function runClaudeCode({ prompt, systemPrompt, onToolResult, onEvent, signal }) {
  const binary = resolveClaudeBinary();
  if (!binary) {
    throw new ClaudeCodeError(
      'No se encontró Claude Code. Instálalo (o la extensión de VS Code) o define CLAUDE_CODE_PATH en backend/.env',
      500
    );
  }
  const emit = onEvent || (() => {});

  const { mcpConfig, promptFile } = prepareWorkDir(systemPrompt);
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages', // texto token por token (streaming)
    '--model', process.env.CLAUDE_CODE_MODEL || 'sonnet',
    '--system-prompt-file', promptFile,
    '--mcp-config', mcpConfig,
    '--strict-mcp-config', // solo nuestro MCP Server
    '--tools', '', // sin herramientas integradas (nada de terminal ni archivos)
    '--allowedTools', TOOLS.map((t) => TOOL_PREFIX + t).join(','),
    '--setting-sources', 'project', // carpeta vacía: no carga hooks ni ajustes personales
    '--no-session-persistence',
  ];

  const useShell = binary.toLowerCase().endsWith('.cmd');
  const child = useShell
    ? spawn(`"${binary}" ${args.map(quoteForShell).join(' ')}`, { cwd: WORK_DIR, shell: true, windowsHide: true })
    : spawn(binary, args, { cwd: WORK_DIR, windowsHide: true });

  return new Promise((resolve, reject) => {
    let buffer = '';
    let stderr = '';
    let result = null;
    let model = null;
    let rateLimited = false;
    let settled = false;
    let textSinceReset = false;
    const pending = new Map(); // tool_use_id -> { tool, input }

    const fail = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      reject(err);
    };

    const timer = setTimeout(() => fail(new ClaudeCodeError('Claude Code tardó demasiado en responder', 504)), TIMEOUT_MS);

    if (signal) {
      if (signal.aborted) return fail(new ClaudeCodeError('Consulta interrumpida', 499));
      signal.addEventListener('abort', () => fail(new ClaudeCodeError('Consulta interrumpida', 499)), { once: true });
    }

    function handleEvent(event) {
      if (event.type === 'stream_event') {
        const e = event.event || {};
        if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
          // El texto que vino antes de una herramienta era un comentario intermedio, no la respuesta
          if (textSinceReset) emit('reset', {});
          textSinceReset = false;
          emit('tool_call', { id: e.content_block.id, tool: stripPrefix(e.content_block.name) });
        } else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
          textSinceReset = true;
          emit('delta', { text: e.delta.text });
        }
      } else if (event.type === 'assistant') {
        model = event.message?.model || model;
        for (const block of event.message?.content || []) {
          if (block.type === 'tool_use') {
            const call = { tool: stripPrefix(block.name), input: block.input || {} };
            pending.set(block.id, call);
            emit('tool_call', { id: block.id, ...call });
          }
        }
      } else if (event.type === 'user') {
        for (const block of event.message?.content || []) {
          if (block.type !== 'tool_result') continue;
          const call = pending.get(block.tool_use_id);
          if (!call) continue;
          const output = Array.isArray(block.content)
            ? block.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
            : String(block.content ?? '');
          onToolResult?.({ id: block.tool_use_id, ...call, output, isError: Boolean(block.is_error) });
        }
      } else if (event.type === 'rate_limit_event' && event.rate_limit_info?.status === 'rejected') {
        rateLimited = true;
      } else if (event.type === 'result') {
        result = event;
      }
    }

    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue; // línea que no es JSON
        }
        handleEvent(event);
      }
    });
    child.stderr.on('data', (chunk) => (stderr += chunk));

    child.on('error', (err) => fail(new ClaudeCodeError(`No se pudo ejecutar Claude Code: ${err.message}`, 500)));

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (rateLimited) {
        return reject(new ClaudeCodeError('Llegaste al límite de uso de tu cuenta de Claude. Intenta más tarde.', 429));
      }
      if (!result) {
        const detail = stderr.trim().split('\n').slice(-3).join(' ') || `código de salida ${code}`;
        return reject(new ClaudeCodeError(`Claude Code no respondió (${detail}). ¿Iniciaste sesión en Claude Code?`));
      }
      if (result.is_error || result.subtype !== 'success') {
        return reject(new ClaudeCodeError(`Claude Code devolvió un error: ${result.result || result.subtype}`));
      }
      const u = result.usage || {};
      resolve({
        text: result.result || '',
        model,
        usage: {
          inputTokens: u.input_tokens || 0,
          outputTokens: u.output_tokens || 0,
          cacheReadTokens: u.cache_read_input_tokens || 0,
          cacheWriteTokens: u.cache_creation_input_tokens || 0,
        },
      });
    });

    child.stdin.end(prompt);
  });
}

module.exports = { runClaudeCode, resolveClaudeBinary, ClaudeCodeError, TOOLS };
