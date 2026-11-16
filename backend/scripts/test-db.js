// backend/scripts/test-db.js   (Módulo 3.8 de la guía)
//   npm run db:test
// 1. Se conecta a la base de datos con el usuario del chatbot
// 2. Lista todas las tablas del schema public
// 3. Muestra la cantidad de registros de cada tabla
// 4. Verifica que el usuario NO pueda escribir (solo lectura)
// 5. Cierra la conexión al final y maneja los errores
const { pool, closePool } = require('../src/config/database');

async function main() {
  console.log(`Conectando a ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} como ${process.env.DB_USER}...`);
  const { rows: [info] } = await pool.query('SELECT current_user, version()');
  console.log(`✔ Conectado como ${info.current_user}`);
  console.log(`  ${info.version.split(',')[0]}\n`);

  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`);

  if (tables.length === 0) {
    console.log('⚠ No hay tablas en public. Ejecuta sql/schema.sql y sql/seed.sql (npm run db:apply).');
  }

  console.log('Tabla'.padEnd(20), 'Registros');
  console.log('-'.repeat(30));
  for (const { table_name } of tables) {
    // El nombre viene del catálogo, pero igual se escapa como identificador
    const ident = '"' + table_name.replaceAll('"', '""') + '"';
    const { rows: [{ total }] } = await pool.query(`SELECT COUNT(*)::int AS total FROM ${ident}`);
    console.log(table_name.padEnd(20), total);
  }

  // Prueba de mínimo privilegio: esto DEBE fallar
  try {
    await pool.query("UPDATE clientes SET telefono = telefono WHERE false");
    console.log('\n✖ PELIGRO: el usuario puede modificar datos. Revisa sql/create_readonly_user.sql');
    process.exitCode = 1;
  } catch (err) {
    console.log(`\n✔ Solo lectura confirmado (intento de UPDATE rechazado: "${err.message}")`);
  }
}

main()
  .catch((err) => {
    console.error('\n✖ Error de conexión:', err.message);
    console.error('  Revisa las variables DB_* de backend/.env (¿está corriendo `npm run db:dev` o tu BD en Neon?)');
    process.exitCode = 1;
  })
  .finally(() => closePool());
