// scripts/dev-db.mjs
// PostgreSQL 17 LOCAL para desarrollar sin instalar nada (ni Docker).
// Descarga binarios oficiales vía npm (embedded-postgres) y guarda los
// datos en .dev-db/ (ignorado por git).
//
//   npm run db:dev              -> inicia (y la primera vez crea tablas + datos + chatbot_reader)
//   npm run db:dev -- --reset   -> borra y vuelve a crear la base de datos
//
// Deja esta terminal abierta mientras desarrollas. Ctrl+C para detenerla.
// En producción usa Neon (Módulo 3 de la guía).
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
const { applySqlFiles, DEFAULT_FILES } = require('./apply-sql.js');

const PORT = Number(process.env.DB_PORT || 5433);
const DB_NAME = process.env.DB_NAME || 'chatbot_urp';
const ADMIN_USER = 'postgres';
const ADMIN_PASSWORD = 'postgres_dev';
const dataDir = path.join(root, '.dev-db', 'data');
const reset = process.argv.includes('--reset');

const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: ADMIN_USER,
  password: ADMIN_PASSWORD,
  port: PORT,
  persistent: true,
  onLog: () => {},
  onError: (e) => console.error('[postgres]', String(e).trim()),
});

if (firstRun) {
  console.log('Inicializando PostgreSQL local (solo la primera vez)...');
  await server.initialise();
}
await server.start();

const adminUrl = `postgresql://${ADMIN_USER}:${ADMIN_PASSWORD}@localhost:${PORT}`;

// ¿Existe la base de datos?
const admin = server.getPgClient('postgres', 'localhost');
await admin.connect();
const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
if (reset && rowCount > 0) {
  console.log(`Borrando la base de datos ${DB_NAME}...`);
  await admin.query(`DROP DATABASE "${DB_NAME}" WITH (FORCE)`);
}
const mustCreate = reset || rowCount === 0;
if (mustCreate) await admin.query(`CREATE DATABASE "${DB_NAME}"`);
await admin.end();

if (mustCreate) {
  console.log(`Creando tablas, datos de prueba y el usuario chatbot_reader en ${DB_NAME}:`);
  await applySqlFiles(`${adminUrl}/${DB_NAME}`, DEFAULT_FILES);
}

console.log(`
PostgreSQL local listo en localhost:${PORT}  (base de datos: ${DB_NAME})
  Admin   : ${adminUrl}/${DB_NAME}
  Chatbot : usuario chatbot_reader (contraseña = DB_PASSWORD de backend/.env)

Deja esta terminal abierta. Ctrl+C para detener.`);

const stop = async () => {
  console.log('\nDeteniendo PostgreSQL...');
  await server.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // mantener vivo el proceso
