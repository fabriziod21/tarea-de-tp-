// Prueba de punta a punta SIN gastar créditos de Claude:
// un servidor falso imita la API de Anthropic (en streaming, como la real) y pide
// herramientas como lo haría Claude.
// Recorre: Express -> controller -> aiAgent -> MCP Server -> PostgreSQL -> respuesta.
// Requiere la BD local encendida (npm run db:dev); si no está, la prueba se omite.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const requests = [];
let script = []; // respuestas que devolverá el "Claude" falso, en orden

/** Convierte un mensaje en los eventos SSE que manda la API de Anthropic. */
function toSse(message) {
  const events = [];
  const push = (type, data) => events.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  push('message_start', { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 1 } } });
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      push('content_block_start', { index, content_block: { type: 'text', text: '' } });
      // el texto llega en dos pedazos, como en un stream real
      const half = Math.ceil(block.text.length / 2);
      push('content_block_delta', { index, delta: { type: 'text_delta', text: block.text.slice(0, half) } });
      push('content_block_delta', { index, delta: { type: 'text_delta', text: block.text.slice(half) } });
    } else {
      push('content_block_start', { index, content_block: { ...block, input: {} } });
      push('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
    }
    push('content_block_stop', { index });
  });
  push('message_delta', { delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: 20 } });
  push('message_stop', {});
  return events.join('');
}

const fakeClaude = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const parsed = JSON.parse(body);
    requests.push({ url: req.url, headers: req.headers, body: parsed });
    const content = script.shift() || [{ type: 'text', text: 'fin' }];
    const message = {
      id: `msg_${requests.length}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content,
      stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    };
    if (parsed.stream) {
      res.setHeader('content-type', 'text/event-stream');
      res.end(toSse(message));
    } else {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(message));
    }
  });
});

let api;
let baseUrl;
let dbAvailable = true;

before(async () => {
  await new Promise((r) => fakeClaude.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fakeClaude.address().port}`;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.CLAUDE_PROVIDER = 'api'; // esta prueba simula la API (no usa Claude Code)
  process.env.AUTH_DISABLED = 'true';
  process.env.RENIEC_MOCK = 'true';
  // La prueba escribe su propio log de auditoría, no el real
  process.env.AUDIT_LOG_FILE = path.join(os.tmpdir(), `chatbot-audit-test-${process.pid}.log`);

  const { pool } = require('../src/config/database');
  try {
    await pool.query('SELECT 1');
  } catch {
    dbAvailable = false;
    return;
  }

  const app = require('../src/app');
  await new Promise((r) => (api = app.listen(0, '127.0.0.1', r)));
  baseUrl = `http://127.0.0.1:${api.address().port}`;
});

after(async () => {
  fakeClaude.close();
  api?.close();
  await require('../src/services/mcpClient.service').closeMcpClient();
  await require('../src/config/database').closePool().catch(() => {});
  fs.rmSync(process.env.AUDIT_LOG_FILE, { force: true });
});

async function ask(message, extra = {}) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, ...extra }),
  });
  return { status: res.status, body: await res.json() };
}

/** Llama a /api/chat/stream y devuelve la lista de eventos SSE recibidos. */
async function askStream(message, extra = {}) {
  const res = await fetch(`${baseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, ...extra }),
  });
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const raw = await res.text();
  return raw
    .split('\n\n')
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return { event: eventLine.slice(7), data: JSON.parse(dataLine.slice(6)) };
    });
}

const DNI_FLOW = () => [
  [
    { type: 'text', text: 'Voy a consultar.' },
    { type: 'tool_use', id: 'tu_1', name: 'consultar_reniec_dni', input: { dni: '12345678' } },
    {
      type: 'tool_use',
      id: 'tu_2',
      name: 'run_readonly_query',
      input: { sql: "SELECT COUNT(*) AS pedidos FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE c.dni = '12345678';" },
    },
  ],
  [{ type: 'text', text: 'El cliente JUAN PEREZ GARCIA (DNI 12345678) tiene 7 pedidos.\n\n```sql\nSELECT 1\n```' }],
];

test('flujo del Módulo 7: RENIEC + SQL en paralelo y respuesta sin SQL', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  requests.length = 0;
  script = DNI_FLOW();

  const { status, body } = await ask('¿Quién es el cliente con DNI 12345678 y cuántos pedidos tiene?');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.match(body.reply, /7 pedidos/);
  assert.doesNotMatch(body.reply, /```sql/, 'el SQL no debe mostrarse si no se pidió');
  assert.equal(body.meta.queries, undefined);
  assert.deepEqual(body.meta.tools.sort(), ['consultar_reniec_dni', 'run_readonly_query']);
  assert.ok(body.meta.sources.length > 0, 'debe usar contexto del RAG');

  // Lo que recibió "Claude" en la 1.ª llamada
  const first = requests[0];
  assert.equal(first.body.stream, true, 'el modo API usa streaming');
  assert.equal(first.body.model, process.env.CLAUDE_MODEL || 'claude-sonnet-5-5');
  assert.ok(first.body.tools.some((t) => t.name === 'run_readonly_query' && t.eager_input_streaming));
  assert.ok(first.body.output_config.effort);
  assert.match(first.headers['anthropic-beta'] || '', /server-side-fallback/);
  assert.match(JSON.stringify(first.body.messages.at(-1)), /contexto_negocio/);

  // 2.ª llamada: ambos resultados en UN solo mensaje de usuario
  const toolResults = requests[1].body.messages.at(-1).content;
  assert.equal(toolResults.length, 2);
  assert.match(toolResults.find((r) => r.tool_use_id === 'tu_1').content, /JUAN/);
  assert.match(toolResults.find((r) => r.tool_use_id === 'tu_2').content, /"pedidos":"7"/);
});

test('streaming: herramientas en vivo, texto token a token y respuesta final', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  requests.length = 0;
  script = DNI_FLOW();

  const events = await askStream('¿Quién es el cliente con DNI 12345678 y cuántos pedidos tiene?');
  const names = events.map((e) => e.event);

  assert.equal(names[0], 'status');
  assert.ok(names.includes('sources'));
  // "Voy a consultar." se transmitió y luego se descartó (era un comentario antes de las herramientas)
  assert.ok(names.indexOf('reset') > names.indexOf('delta'));

  const tools = events.filter((e) => e.event === 'tool').map((e) => e.data);
  const sql = tools.filter((d) => d.tool === 'run_readonly_query');
  assert.deepEqual(sql.map((d) => d.state), ['running', 'ok']);
  assert.equal(sql[0].arg, null, 'el SQL no viaja al navegador si no se pidió');
  assert.equal(sql[1].rowCount, 1);
  assert.equal(tools.find((d) => d.tool === 'consultar_reniec_dni' && d.state === 'ok').summary, 'JUAN PEREZ GARCIA');

  const finalText = events
    .slice(names.lastIndexOf('reset') + 1)
    .filter((e) => e.event === 'delta')
    .map((e) => e.data.text)
    .join('');
  assert.match(finalText, /7 pedidos/);

  const done = events.at(-1);
  assert.equal(done.event, 'done');
  assert.match(done.data.reply, /7 pedidos/);
  assert.doesNotMatch(done.data.reply, /```sql/);
});

test('SQL peligroso: el MCP lo rechaza y Claude recibe el error', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  requests.length = 0;
  script = [
    [{ type: 'tool_use', id: 'tu_x', name: 'run_readonly_query', input: { sql: 'DELETE FROM pedidos' } }],
    [{ type: 'text', text: 'Solo puedo consultar datos, no borrarlos.' }],
  ];

  const { status, body } = await ask('borra todos los pedidos y muéstrame el SQL', { showSql: true });
  assert.equal(status, 200);
  const result = requests[1].body.messages.at(-1).content[0];
  assert.equal(result.is_error, true);
  assert.match(result.content, /SQL rechazado/);
  assert.equal(body.meta.queries.length, 1);
  assert.match(body.meta.queries[0].error, /rechazado/);
});

test('el prompt de sistema se puede ver desde la web', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  const res = await fetch(`${baseUrl}/api/chat/system-prompt`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.prompt, require('../src/services/aiAgent.service').SYSTEM_PROMPT);
  assert.match(body.prompt, /Alcance/);
  assert.match(body.model, /^Claude API/);
});

test('visor de la base vectorial: lista fragmentos y busca por significado', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  const list = await (await fetch(`${baseUrl}/api/rag/documents`)).json();
  assert.equal(list.success, true, JSON.stringify(list));
  assert.ok(list.chunks.length > 0);
  assert.equal(list.dimensions, 384);
  assert.equal(list.chunks[0].vector.length, 6, 'solo viaja un pedazo del vector');
  assert.equal(list.chunks[0].embedding, undefined);

  const res = await fetch(`${baseUrl}/api/rag/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'pedidos de un cliente por DNI' }),
  });
  const search = await res.json();
  assert.equal(res.status, 200, JSON.stringify(search));
  assert.ok(search.results.length > 0 && search.results.length <= 4);
  const scores = search.results.map((r) => r.score);
  assert.deepEqual(scores, scores.slice().sort((a, b) => b - a), 'ordenados de más a menos parecido');
  assert.ok(search.results.every((r) => r.sentToClaude === r.score >= search.minScore));

  const empty = await fetch(`${baseUrl}/api/rag/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '  ' }),
  });
  assert.equal(empty.status, 400);
});

test('auditoría: el SQL rechazado queda registrado y se puede ver desde la web', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  await new Promise((r) => setTimeout(r, 100)); // el log se escribe de forma asíncrona
  const body = await (await fetch(`${baseUrl}/api/audit/recent?limit=50`)).json();
  assert.equal(body.success, true);
  assert.ok(body.entries.every((e) => e.user_id === 'dev-local'), 'solo las entradas del usuario');
  const times = body.entries.map((e) => e.timestamp);
  assert.deepEqual(times, times.slice().sort().reverse(), 'la más nueva primero');
  const rejected = body.entries.find((e) => e.type === 'sql' && e.sql === 'DELETE FROM pedidos');
  assert.match(rejected.error, /rechazado/);
});

test('valida el mensaje vacío', async (t) => {
  if (!dbAvailable) return t.skip('BD local apagada (npm run db:dev)');
  const { status } = await ask('   ');
  assert.equal(status, 400);
});
