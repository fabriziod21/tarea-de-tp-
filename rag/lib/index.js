// rag/lib/index.js
const config = require('./config');
const { embed, embedOne } = require('./embedder');
const { loadDocuments } = require('./documents');
const { getStore, localStore } = require('./stores');

/**
 * Vectoriza los documentos y los guarda en el proveedor indicado.
 * Siempre guarda también el índice local, que sirve de respaldo.
 */
async function buildIndex(provider = config.provider) {
  const chunks = loadDocuments();
  const vectors = await embed(chunks.map((c) => `${c.title}\n${c.text}`));
  const withEmbeddings = chunks.map((c, i) => ({ ...c, embedding: vectors[i] }));

  await localStore.save(withEmbeddings);
  if (provider !== 'local') await getStore(provider).save(withEmbeddings);

  return { provider, chunks: withEmbeddings.length };
}

// Evita indexar dos veces si llegan varias preguntas a la vez con la base vacía
let indexing = null;
function indexOnce(provider) {
  if (!indexing) {
    console.log(`[rag] ${provider} está vacío: cargando los documentos de rag/documents ...`);
    indexing = buildIndex(provider).finally(() => {
      indexing = null;
    });
  }
  return indexing;
}

/**
 * Busca los k fragmentos más parecidos a la pregunta.
 * Si el proveedor configurado falla (p. ej. ChromaDB apagado), usa el índice local.
 */
async function retrieve(question, k = 4) {
  const store = getStore();
  // Sin índice (o creado con otro modelo): se construye solo, los documentos son pocos
  if (store.name === 'local' && localStore.isStale()) await buildIndex('local');

  const vector = await embedOne(question);
  try {
    let results = await store.search(vector, k);
    // ChromaDB / pgvector recién instalados (vacíos): se cargan solos la primera vez
    if (results.length === 0 && store.name !== 'local') {
      await indexOnce(store.name);
      results = await store.search(vector, k);
    }
    return { provider: store.name, results };
  } catch (err) {
    if (store.name === 'local') throw err;
    console.warn(`[rag] ${store.name} no disponible (${err.message}); usando índice local`);
    if (localStore.isStale()) await buildIndex('local');
    return { provider: 'local (respaldo)', results: await localStore.search(vector, k) };
  }
}

/**
 * Todo lo que hay guardado en la base vectorial (para el visor de la web).
 * Igual que retrieve(): si el proveedor falla, muestra el índice local.
 */
async function listChunks() {
  const store = getStore();
  if (store.name === 'local' && localStore.isStale()) await buildIndex('local');
  try {
    return { provider: store.name, chunks: await store.list() };
  } catch (err) {
    if (store.name === 'local') throw err;
    console.warn(`[rag] ${store.name} no disponible (${err.message}); usando índice local`);
    if (localStore.isStale()) await buildIndex('local');
    return { provider: 'local (respaldo)', chunks: await localStore.list() };
  }
}

module.exports = { buildIndex, retrieve, listChunks, loadDocuments, embed, config };
