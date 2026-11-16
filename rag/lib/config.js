// rag/lib/config.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env'), quiet: true });

module.exports = {
  provider: (process.env.RAG_PROVIDER || 'local').toLowerCase(),
  documentsDir: path.resolve(__dirname, '../documents'),
  localIndexPath: path.resolve(__dirname, '../embeddings/index.json'),
  chromaUrl: process.env.CHROMA_URL || 'http://127.0.0.1:8000',
  chromaCollection: process.env.CHROMA_COLLECTION || 'negocio_docs',
  // La guía menciona all-MiniLM-L6-v2 (el de ChromaDB), pero ese modelo está entrenado
  // en inglés. Su versión multilingüe tiene las mismas 384 dimensiones y encuentra
  // mucho mejor los textos en español. Para usar el de la guía:
  // EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2 (y vuelve a correr npm run rag:index).
  embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  dimensions: 384,
};
