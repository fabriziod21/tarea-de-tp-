// mcp-server/src/tools/runReadonlyQuery.tool.js
const { z } = require('zod');
const { runReadOnly, MAX_ROWS } = require('../services/postgres.service');

/**
 * Ejecuta un SELECT generado por Claude.
 * Validación, LIMIT automático y transacción READ ONLY están en
 * postgres.service.runReadOnly.
 */
async function runReadonlyQuery(sql) {
  return runReadOnly(sql);
}

module.exports = {
  name: 'run_readonly_query',
  title: 'Ejecutar consulta de lectura',
  description:
    'Ejecuta UNA consulta SQL de solo lectura (SELECT o WITH ... SELECT) en PostgreSQL y devuelve las filas. ' +
    `Máximo ${MAX_ROWS} filas por consulta (si hay más, "truncated" será true: usa agregaciones o filtros). ` +
    'Prohibido: INSERT, UPDATE, DELETE, DDL, varias sentencias y comentarios. ' +
    'Revisa las columnas con describe_table antes de escribir el SQL.',
  inputSchema: {
    sql: z.string().min(1).max(5000).describe('Consulta SELECT de PostgreSQL'),
  },
  handler: async ({ sql }) => runReadonlyQuery(sql),
  runReadonlyQuery,
};
