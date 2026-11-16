// rag/lib/embedder.js
// Convierte textos en vectores (embeddings). Claude NO genera embeddings,
// así que usamos all-MiniLM-L6-v2 (el modelo por defecto de ChromaDB),
// ejecutado localmente con transformers.js. La primera vez descarga ~23 MB.
const config = require('./config');

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('feature-extraction', config.embeddingModel, { dtype: 'q8' });
    })().catch((err) => {
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

/**
 * @param {string[]} texts
 * @returns {Promise<number[][]>} vectores normalizados (norma 1)
 */
async function embed(texts) {
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
}

async function embedOne(text) {
  const [vector] = await embed([text]);
  return vector;
}

module.exports = { embed, embedOne };
