// mcp-server/src/tools/describeTable.tool.js
const { z } = require('zod');
const { query } = require('../services/postgres.service');

async function describeTable(tableName) {
  // Consulta parametrizada: el nombre nunca se concatena en el SQL
  const exists = await query(
    `SELECT c.oid
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r','p','v','m')
       AND has_table_privilege(c.oid, 'SELECT')`,
    [tableName]
  );
  if (exists.length === 0) {
    throw new Error(`La tabla "${tableName}" no existe en el esquema public. Usa list_tables para ver las disponibles.`);
  }
  const oid = exists[0].oid;

  const columns = await query(
    `SELECT a.attname AS column_name,
            format_type(a.atttypid, a.atttypmod) AS data_type,
            NOT a.attnotnull AS nullable,
            pg_get_expr(d.adbin, d.adrelid) AS default_value,
            col_description(a.attrelid, a.attnum) AS descripcion
     FROM pg_attribute a
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [oid]
  );

  const constraints = await query(
    `SELECT conname AS name,
            CASE contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
                         WHEN 'f' THEN 'FOREIGN KEY' WHEN 'c' THEN 'CHECK' END AS type,
            pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = $1 AND contype IN ('p', 'u', 'f', 'c')
     ORDER BY contype, conname`,
    [oid]
  );

  const [{ descripcion } = {}] = await query(`SELECT obj_description($1::oid, 'pg_class') AS descripcion`, [oid]);

  return { table: tableName, descripcion: descripcion || null, columns, constraints };
}

module.exports = {
  name: 'describe_table',
  title: 'Describir tabla',
  description:
    'Devuelve las columnas de una tabla (tipo, si acepta NULL, valor por defecto y descripción) ' +
    'y sus restricciones (PK, FK, UNIQUE, CHECK). Úsala antes de escribir SQL sobre esa tabla.',
  inputSchema: {
    table_name: z.string().min(1).max(63).describe('Nombre exacto de la tabla, por ejemplo "clientes"'),
  },
  handler: async ({ table_name }) => describeTable(table_name),
  describeTable,
};
