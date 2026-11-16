// backend/src/controllers/chat.controller.js
const config = require('../config/env');
const { runAgent, SYSTEM_PROMPT } = require('../services/aiAgent.service');

const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 4000;

/** Limpia el historial que manda el frontend (solo texto, últimos N mensajes). */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const clean = history
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));

  // La conversación con Claude debe empezar con un mensaje del usuario
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

function validateMessage(message) {
  if (typeof message !== 'string' || !message.trim()) return 'El mensaje no puede estar vacío';
  if (message.length > MAX_QUESTION_LENGTH) return `El mensaje supera ${MAX_QUESTION_LENGTH} caracteres`;
  return null;
}

// POST /api/chat   body: { message, history?, showSql? }   -> respuesta completa en JSON
async function postChat(req, res) {
  const { message, history, showSql } = req.body || {};

  const invalid = validateMessage(message);
  if (invalid) return res.status(400).json({ success: false, error: invalid });

  try {
    const result = await runAgent({
      question: message.trim(),
      history: sanitizeHistory(history),
      user: req.user,
      showSql: showSql === true,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[chat] error:', err.message);
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

// POST /api/chat/stream   body: { message, history?, showSql? }
// Respuesta en streaming (Server-Sent Events): el frontend ve en vivo qué herramientas
// usa Claude y el texto mientras se escribe. Eventos: status, sources, tool, delta,
// reset, done ({ reply, meta }) y error ({ error, status }).
async function postChatStream(req, res) {
  const { message, history, showSql } = req.body || {};

  const invalid = validateMessage(message);
  if (invalid) return res.status(400).json({ success: false, error: invalid });

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // que los proxies no acumulen el stream
  });
  res.flushHeaders();

  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
  };

  // Si el usuario cierra la pestaña o presiona Esc, se corta el trabajo de Claude
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  // Comentario cada 15 s para que ningún proxy cierre la conexión por inactividad
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  try {
    const result = await runAgent({
      question: message.trim(),
      history: sanitizeHistory(history),
      user: req.user,
      showSql: showSql === true,
      onEvent: send,
      signal: controller.signal,
    });
    send('done', result);
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error('[chat/stream] error:', err.message);
      send('error', { error: err.message, status: err.status || 500 });
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

/** GET /api/chat/system-prompt -> el prompt de sistema que recibe Claude (solo lectura). */
function getSystemPrompt(req, res) {
  res.json({
    success: true,
    prompt: SYSTEM_PROMPT,
    file: 'backend/src/services/aiAgent.service.js',
    model:
      config.claude.provider === 'code'
        ? `Claude Code (${process.env.CLAUDE_CODE_MODEL || 'sonnet'})`
        : `Claude API (${config.claude.model})`,
  });
}

module.exports = { postChat, postChatStream, getSystemPrompt, sanitizeHistory };
