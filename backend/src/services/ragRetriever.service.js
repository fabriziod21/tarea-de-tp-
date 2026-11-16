// backend/src/services/ragRetriever.service.js
// RAG Retriever (Módulo 7, paso 3): vectoriza la pregunta y trae los
// fragmentos de documentación del negocio más parecidos.
const { retrieve, listChunks, config: ragConfig } = require('@chatbot/rag');

const MIN_SCORE = 0.25; // por debajo de esto el fragmento casi no tiene relación

async function retrieveContext(question, k = 4) {
  try {
    const { provider, results } = await retrieve(question, k);
    return { provider, chunks: results.filter((r) => r.score >= MIN_SCORE) };
  } catch (err) {
    // Sin RAG el agente igual funciona: puede explorar el esquema con las herramientas
    console.warn('[rag] no se pudo obtener contexto:', err.message);
    return { provider: 'no disponible', chunks: [] };
  }
}

/** Texto que se agrega a la pregunta del usuario. */
function formatContext(chunks) {
  if (chunks.length === 0) return 'No se encontró documentación relacionada.';
  return chunks.map((c) => `### ${c.title}\n${c.text}`).join('\n\n');
}

/** Carga el modelo de embeddings al arrancar para que la 1.ª pregunta no tarde. */
function warmUp() {
  return retrieveContext('clientes y pedidos', 1);
}

// ---------------------------------------------------------------------------
// Visor de la base vectorial (web)
// ---------------------------------------------------------------------------
const VECTOR_PREVIEW = 6; // primeros números de cada vector que se muestran
const chunkNumber = (id) => Number(String(id).split('#').pop()) || 0;
const round = (x) => Math.round(x * 1000) / 1000;

function whereStored(provider) {
  if (provider === 'chroma') return { collection: ragConfig.chromaCollection, url: ragConfig.chromaUrl };
  if (provider === 'pgvector') return { collection: 'rag.chunks', url: 'PostgreSQL (pgvector)' };
  return { collection: 'rag/embeddings/index.json', url: null };
}

/** Todos los fragmentos guardados, con un pedazo de su vector. */
async function describeVectorStore() {
  const { provider, chunks } = await listChunks();
  const sorted = chunks
    .slice()
    .sort((a, b) => String(a.source).localeCompare(String(b.source)) || chunkNumber(a.id) - chunkNumber(b.id));
  return {
    provider,
    ...whereStored(provider),
    model: ragConfig.embeddingModel,
    dimensions: sorted[0]?.embedding.length || ragConfig.dimensions,
    minScore: MIN_SCORE,
    chunks: sorted.map(({ embedding, ...c }) => ({ ...c, vector: embedding.slice(0, VECTOR_PREVIEW).map(round) })),
  };
}

/** La misma búsqueda que hace el agente antes de llamar a Claude (paso 3), con todos los puntajes. */
async function searchVectorStore(query, k = 4) {
  const started = Date.now();
  const { provider, results } = await retrieve(query, k);
  return {
    provider,
    minScore: MIN_SCORE,
    durationMs: Date.now() - started,
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      source: r.source,
      score: round(r.score),
      sentToClaude: r.score >= MIN_SCORE,
    })),
  };
}

module.exports = { retrieveContext, formatContext, warmUp, describeVectorStore, searchVectorStore };
