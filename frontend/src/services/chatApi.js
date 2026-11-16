// frontend/src/services/chatApi.js
import { getIdToken } from './firebase';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

async function authHeaders() {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Pregunta en STREAMING (POST /api/chat/stream, Server-Sent Events).
 * Llama a onEvent(tipo, datos) por cada evento: status, sources, tool, delta, reset, done, error.
 * @param {{ message: string, history: Array<{role:string, content:string}>, showSql: boolean }} payload
 * @param {{ onEvent: (type: string, data: object) => void, signal?: AbortSignal }} opts
 */
export async function streamMessage(payload, { onEvent, signal }) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido el backend?');
  }

  // Errores antes de empezar el stream (401, 429, 400) llegan como JSON normal
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error del servidor (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  // El servidor manda un "ping" cada 15 s: si pasan 45 s sin nada, la conexión murió
  let stalled = false;
  let watchdog;
  const arm = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      stalled = true;
      reader.cancel().catch(() => {});
    }, 45000);
  };
  arm();

  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (err) {
      clearTimeout(watchdog);
      throw err;
    }
    const { value, done } = chunk;
    if (done) {
      clearTimeout(watchdog);
      if (stalled) throw new Error('El servidor dejó de responder. Intenta de nuevo.');
      break;
    }
    arm();
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue; // comentarios ": ping"

      if (event === 'done' || event === 'error') finished = true;
      onEvent(event, JSON.parse(data));
    }
  }

  if (!finished) throw new Error('La conexión con el servidor se cortó antes de terminar.');
}

/** GET/POST JSON con el token del usuario; lanza Error con el mensaje del servidor. */
async function requestJson(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: await authHeaders(),
      ...(body && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está encendido el backend?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error del servidor (${res.status})`);
  return data;
}

/** Prompt de sistema que recibe Claude: { prompt, file, model }. */
export const getSystemPrompt = () => requestJson('/api/chat/system-prompt');

/** Contenido de la base vectorial: { provider, collection, url, model, dimensions, minScore, chunks }. */
export const getVectorStore = () => requestJson('/api/rag/documents');

/** Últimas operaciones del Audit Logger del usuario: { file, entries }. */
export const getRecentAudit = (limit = 15) => requestJson(`/api/audit/recent?limit=${limit}`);

/** Búsqueda por significado (la misma del paso 3, sin llamar a Claude). */
export const searchVectorStore = (query) => requestJson('/api/rag/search', { method: 'POST', body: { query } });

/** Estado del backend (BD, modelo, auth, RAG, RENIEC). */
export async function getHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
