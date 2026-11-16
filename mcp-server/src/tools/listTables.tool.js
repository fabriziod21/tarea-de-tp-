// mcp-server/src/tools/listTables.tool.js
const { query } = require('../services/postgres.service');

// Se usa pg_catalog en vez de information_schema porque algunas vistas de
// information_schema ocultan objetos a usuarios que solo tienen SELECT.
async function listTables() {
  return query(`
    SELECT c.relname AS table_name,
           CASE c.relkind
             WHEN 'r' THEN 'BASE TABLE'
             WHEN 'p' THEN 'BASE TABLE'
             WHEN 'v' THEN 'VIEW'
             WHEN 'm' THEN 'MATERIALIZED VIEW'
           END AS table_type,
           obj_description(c.oid, 'pg_class') AS descripcion
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND has_table_privilege(c.oid, 'SELECT')
    ORDER BY c.relname
  `);
}

module.exports = {
  name: 'list_tables',
  title: 'Listar tablas',
  description:
    'Lista las tablas y vistas del esquema public de la base de datos del negocio, con su descripción. ' +
    'Úsala primero para saber qué datos existen.',
  inputSchema: {},
  handler: async () => ({ tables: await listTables() }),
  listTables,
};
