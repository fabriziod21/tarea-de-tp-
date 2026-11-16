// mcp-server/src/config/database.js
// Pool de conexiones a PostgreSQL con el usuario de SOLO LECTURA.
// (Corrección de la guía: este archivo vive dentro del MCP Server, que es
// quien realmente consulta la BD. backend/src/config/database.js lo reexporta.)
require('./env');
const { Pool, types } = require('pg');

// DATE y TIMESTAMP (sin zona) se devuelven tal cual están en la BD.
// Si no, node-postgres los convierte a Date con la zona horaria del servidor
// y al pasarlos a JSON salen en UTC (10:24 en Lima aparecería como 15:24).
types.setTypeParser(1082, (v) => v); // DATE
types.setTypeParser(1114, (v) => v); // TIMESTAMP WITHOUT TIME ZONE

function sslConfig() {
  if (process.env.DB_SSL !== 'true') return false;
  // Neon usa certificados válidos, así que verificamos el certificado.
  // Si tu proveedor usa uno autofirmado, pon DB_SSL_REJECT_UNAUTHORIZED=false.
  return { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

function buildConfig() {
  const common = {
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    // Neon "duerme" la BD cuando no se usa: el primer arranque puede tardar
    // varios segundos, por eso no usamos los 2 s de la guía.
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
    application_name: 'chatbot-mcp-server',
  };

  if (process.env.DATABASE_URL) {
    return { ...common, connectionString: process.env.DATABASE_URL, ssl: sslConfig() || undefined };
  }

  return {
    ...common,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: sslConfig(),
  };
}

const pool = new Pool(buildConfig());

pool.on('error', (err) => {
  // console.error (stderr) para no romper el protocolo MCP en modo stdio
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

async function closePool() {
  await pool.end();
}

module.exports = { pool, closePool };
