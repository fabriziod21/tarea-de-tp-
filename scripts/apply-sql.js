// scripts/apply-sql.js
// Ejecuta los archivos de /sql con el usuario ADMINISTRADOR.
//
//   npm run db:apply                       -> schema.sql + seed.sql + create_readonly_user.sql
//   npm run db:apply -- pgvector.sql       -> solo los archivos que indiques
//
// Usa DB_ADMIN_URL de backend/.env (en Neon: la cadena de conexión del dueño,
// NO la de chatbot_reader). El texto __READER_PASSWORD__ se reemplaza por DB_PASSWORD.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env'), quiet: true });

const SQL_DIR = path.resolve(__dirname, '../sql');
const DEFAULT_FILES = ['schema.sql', 'seed.sql', 'create_readonly_user.sql'];

function readSql(file) {
  const fullPath = path.isAbsolute(file) ? file : path.join(SQL_DIR, file);
  let sql = fs.readFileSync(fullPath, 'utf8');
  if (sql.includes('__READER_PASSWORD__')) {
    const password = process.env.DB_PASSWORD;
    if (!password) throw new Error('Define DB_PASSWORD en backend/.env (contraseña de chatbot_reader)');
    sql = sql.replaceAll('__READER_PASSWORD__', password.replaceAll("'", "''"));
  }
  return sql;
}

async function applySqlFiles(connectionString, files = DEFAULT_FILES, { ssl } = {}) {
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    for (const file of files) {
      process.stdout.write(`  -> ${file} ... `);
      await client.query(readSql(file));
      console.log('ok');
    }
  } finally {
    await client.end();
  }
}

module.exports = { applySqlFiles, DEFAULT_FILES };

if (require.main === module) {
  const url = process.env.DB_ADMIN_URL;
  if (!url) {
    console.error('Falta DB_ADMIN_URL en backend/.env (cadena de conexión del usuario administrador).');
    process.exit(1);
  }
  const files = process.argv.slice(2);
  const ssl = /sslmode=require|neon\.tech/.test(url) ? { rejectUnauthorized: true } : undefined;
  console.log('Aplicando SQL con el usuario administrador:');
  applySqlFiles(url, files.length ? files : DEFAULT_FILES, { ssl })
    .then(() => console.log('Listo.'))
    .catch((err) => {
      console.error('\nError:', err.message);
      process.exit(1);
    });
}
