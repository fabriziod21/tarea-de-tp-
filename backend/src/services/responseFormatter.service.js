// backend/src/services/responseFormatter.service.js
// Response Formatter (Módulo 7, paso 9): arma la respuesta final para el frontend.
// Garantiza que el SQL NO se muestre salvo que el usuario lo pida.

const SQL_FENCE_RE = /```sql[\s\S]*?```/gi;

function userAskedForSql(question, showSql) {
  return Boolean(showSql) || /\bsql\b|\bquery\b|consulta (que )?(usaste|ejecutaste|hiciste)/i.test(question);
}

function formatResponse({ question, text, showSql, trace, rag, model, durationMs, usage }) {
  const wantsSql = userAskedForSql(question, showSql);

  let reply = (text || '').trim();
  if (!wantsSql) {
    reply = reply.replace(SQL_FENCE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (!reply) {
    reply = 'No pude generar una respuesta. ¿Puedes reformular la pregunta?';
  }

  return {
    reply,
    meta: {
      model,
      durationMs,
      tools: trace.toolCalls.map((t) => t.tool),
      // Fragmentos del RAG que se usaron como contexto (títulos)
      sources: rag.chunks.map((c) => c.title),
      ragProvider: rag.provider,
      // El SQL solo viaja al frontend si el usuario lo pidió
      ...(wantsSql && { queries: trace.queries }),
      usage,
    },
  };
}

module.exports = { formatResponse, userAskedForSql };
