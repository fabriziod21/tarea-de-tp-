// backend/src/controllers/rag.controller.js
// Visor de la base vectorial (ChromaDB / pgvector / índice local) desde la web.
const { describeVectorStore, searchVectorStore } = require('../services/ragRetriever.service');

const MAX_QUERY_LENGTH = 500;

/** GET /api/rag/documents -> fragmentos guardados en la base vectorial. */
async function getVectorStore(req, res) {
  try {
    res.json({ success: true, ...(await describeVectorStore()) });
  } catch (err) {
    console.error('[rag] visor:', err.message);
    res.status(503).json({ success: false, error: `No se pudo leer la base vectorial: ${err.message}` });
  }
}

/** POST /api/rag/search { query } -> fragmentos más parecidos, como los recibiría Claude. */
async function postVectorSearch(req, res) {
  const query = req.body?.query;
  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ success: false, error: 'Escribe algo para buscar' });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ success: false, error: `La búsqueda supera ${MAX_QUERY_LENGTH} caracteres` });
  }
  try {
    res.json({ success: true, query: query.trim(), ...(await searchVectorStore(query.trim())) });
  } catch (err) {
    console.error('[rag] búsqueda:', err.message);
    res.status(503).json({ success: false, error: `No se pudo buscar: ${err.message}` });
  }
}

module.exports = { getVectorStore, postVectorSearch };
