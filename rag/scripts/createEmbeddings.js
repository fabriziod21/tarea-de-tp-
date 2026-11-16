// rag/scripts/createEmbeddings.js
//   npm run rag:index                         (usa RAG_PROVIDER de backend/.env)
//   npm run rag:index -- --provider chroma    (o pgvector / local)
//   npm run rag:index -- --query "¿qué es un cliente frecuente?"   (prueba una búsqueda)
//
// Vuelve a ejecutarlo cada vez que cambies algo en rag/documents.
const { buildIndex, retrieve, config } = require('../lib');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function main() {
  const provider = arg('provider') || config.provider;
  const query = arg('query');

  if (!query) {
    console.log(`Generando embeddings con ${config.embeddingModel} -> ${provider} ...`);
    const t = Date.now();
    const { chunks } = await buildIndex(provider);
    console.log(`✔ ${chunks} fragmentos indexados en ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }

  const question = query || '¿Cuántos pedidos tiene el cliente con DNI 12345678?';
  const { provider: used, results } = await retrieve(question, 3);
  console.log(`\nPrueba de búsqueda (${used}): "${question}"`);
  for (const r of results) console.log(`  ${r.score.toFixed(3)}  ${r.title}`);
}

main().catch((err) => {
  console.error('✖', err.message);
  process.exit(1);
});
