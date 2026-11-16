// rag/lib/stores.js
// Tres "bases vectoriales" con la misma interfaz: save(chunks), search(vector, k) y list().
//   local    -> archivo rag/embeddings/index.json (cero infraestructura; ideal para Render Free)
//   chroma   -> ChromaDB (desarrollo, como pide la guía)
//   pgvector -> extensión de PostgreSQL en Neon (producción, como pide la guía)
const fs = require('fs');
const path = require('path');
const config = require('./config');

// ---------- local (JSON) ----------
const localStore = {
  name: 'local',
  _cache: null,

  exists() {
    return fs.existsSync(config.localIndexPath);
  },

  /** true si no hay índice o si se creó con otro modelo de embeddings */
  isStale() {
    if (!this.exists()) return true;
    try {
      const { model } = JSON.parse(fs.readFileSync(config.localIndexPath, 'utf8'));
      return model !== config.embeddingModel;
    } catch {
      return true;
    }
  },

  async save(chunks) {
    fs.mkdirSync(path.dirname(config.localIndexPath), { recursive: true });
    const index = { model: config.embeddingModel, createdAt: new Date().toISOString(), chunks };
    fs.writeFileSync(config.localIndexPath, JSON.stringify(index));
    this._cache = index;
  },

  load() {
    if (!this._cache) {
      if (!this.exists()) throw new Error('No existe el índice local. Ejecuta: npm run rag:index');
      this._cache = JSON.parse(fs.readFileSync(config.localIndexPath, 'utf8'));
    }
    return this._cache;
  },

  async search(vector, k) {
    // Vectores normalizados: similitud coseno = producto punto
    return this.load()
      .chunks.map((c) => ({ ...c, score: c.embedding.reduce((s, x, i) => s + x * vector[i], 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ embedding, ...rest }) => rest);
  },

  async list() {
    return this.load().chunks;
  },
};

// ---------- ChromaDB ----------
function chromaClient() {
  const { ChromaClient } = require('chromadb');
  const url = new URL(config.chromaUrl);
  return new ChromaClient({
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 8000)),
    ssl: url.protocol === 'https:',
  });
}

const chromaStore = {
  name: 'chroma',

  async collection() {
    // Pasamos los vectores ya calculados, así que no necesitamos embeddingFunction
    return chromaClient().getOrCreateCollection({ name: config.chromaCollection, embeddingFunction: null });
  },

  async save(chunks) {
    const client = chromaClient();
    await client.deleteCollection({ name: config.chromaCollection }).catch(() => {});
    const col = await this.collection();
    await col.add({
      ids: chunks.map((c) => c.id),
      embeddings: chunks.map((c) => c.embedding),
      documents: chunks.map((c) => c.text),
      metadatas: chunks.map((c) => ({ source: c.source, title: c.title })),
    });
  },

  async search(vector, k) {
    const col = await this.collection();
    const res = await col.query({ queryEmbeddings: [vector], nResults: k, include: ['documents', 'metadatas', 'distances'] });
    return res.ids[0].map((id, i) => ({
      id,
      source: res.metadatas[0][i]?.source,
      title: res.metadatas[0][i]?.title,
      text: res.documents[0][i],
      // distancia L2 entre vectores normalizados -> similitud coseno
      score: 1 - (res.distances[0][i] ?? 0) / 2,
    }));
  },

  async list() {
    const col = await this.collection();
    const res = await col.get({ include: ['documents', 'metadatas', 'embeddings'] });
    return res.rows().map((r) => ({
      id: r.id,
      source: r.metadata?.source,
      title: r.metadata?.title,
      text: r.document,
      embedding: Array.from(r.embedding || []),
    }));
  },
};

// ---------- pgvector ----------
const toVectorLiteral = (v) => `[${v.join(',')}]`;

const pgvectorStore = {
  name: 'pgvector',
  _readPool: null,

  readPool() {
    // Lectura con el usuario del chatbot (solo SELECT)
    if (!this._readPool) {
      const { Pool } = require('pg');
      this._readPool = new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
        max: 2,
        connectionTimeoutMillis: 15000,
      });
    }
    return this._readPool;
  },

  async save(chunks) {
    // Escritura con el usuario administrador (solo en el script de indexación)
    const { Client } = require('pg');
    if (!process.env.DB_ADMIN_URL) throw new Error('Falta DB_ADMIN_URL para escribir en pgvector');
    const client = new Client({ connectionString: process.env.DB_ADMIN_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM rag.chunks');
      for (const c of chunks) {
        await client.query(
          'INSERT INTO rag.chunks (id, source, title, content, embedding) VALUES ($1, $2, $3, $4, $5::vector)',
          [c.id, c.source, c.title, c.text, toVectorLiteral(c.embedding)]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      await client.end();
    }
  },

  async search(vector, k) {
    const { rows } = await this.readPool().query(
      `SELECT id, source, title, content AS text, 1 - (embedding <=> $1::vector) AS score
       FROM rag.chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [toVectorLiteral(vector), k]
    );
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  },

  async list() {
    const { rows } = await this.readPool().query(
      'SELECT id, source, title, content AS text, embedding::text AS embedding FROM rag.chunks'
    );
    // pgvector devuelve el vector como texto "[0.1,0.2,...]"
    return rows.map((r) => ({ ...r, embedding: JSON.parse(r.embedding) }));
  },
};

const STORES = { local: localStore, chroma: chromaStore, pgvector: pgvectorStore };

function getStore(name = config.provider) {
  const store = STORES[name];
  if (!store) throw new Error(`RAG_PROVIDER desconocido: ${name} (usa local, chroma o pgvector)`);
  return store;
}

module.exports = { getStore, localStore, chromaStore, pgvectorStore };
