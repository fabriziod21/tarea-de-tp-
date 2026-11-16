-- ============================================================
-- RAG en producción con pgvector (Neon ya trae la extensión).
-- Solo es necesario si usas RAG_PROVIDER=pgvector.
-- Ejecutar con el usuario ADMINISTRADOR.
-- Los vectores son de 384 dimensiones (modelo all-MiniLM-L6-v2).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Esquema separado: así list_tables (que mira "public") no lo muestra
-- como si fuera una tabla del negocio.
CREATE SCHEMA IF NOT EXISTS rag;

CREATE TABLE IF NOT EXISTS rag.chunks (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  title      TEXT,
  content    TEXT NOT NULL,
  embedding  vector(384) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag.chunks USING hnsw (embedding vector_cosine_ops);

-- El chatbot solo necesita leer los fragmentos
GRANT USAGE ON SCHEMA rag TO chatbot_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA rag TO chatbot_reader;
