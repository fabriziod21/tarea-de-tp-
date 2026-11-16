// mcp-server/src/tools/getRelationships.tool.js
const { z } = require('zod');
const { query } = require('../services/postgres.service');

async function getRelationships(tableName = null) {
  return query(
    `SELECT con.conname AS constraint_name,
            src.relname AS tabla_origen,
            array_agg(sa.attname::text ORDER BY k.ord) AS columnas_origen,
            tgt.relname AS tabla_destino,
            array_agg(ta.attname::text ORDER BY k.ord) AS columnas_destino
     FROM pg_constraint con
     JOIN pg_class src ON src.oid = con.conrelid
     JOIN pg_class tgt ON tgt.oid = con.confrelid
     JOIN pg_namespace n ON n.oid = src.relnamespace
     CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(src_att, tgt_att, ord)
     JOIN pg_attribute sa ON sa.attrelid = con.conrelid AND sa.attnum = k.src_att
     JOIN pg_attribute ta ON ta.attrelid = con.confrelid AND ta.attnum = k.tgt_att
     WHERE con.contype = 'f'
       AND n.nspname = 'public'
       AND ($1::text IS NULL OR src.relname = $1 OR tgt.relname = $1)
     GROUP BY con.conname, src.relname, tgt.relname
     ORDER BY src.relname, con.conname`,
    [tableName]
  );
}

module.exports = {
  name: 'get_relationships',
  title: 'Relaciones entre tablas',
  description:
    'Devuelve las llaves foráneas (qué columna de qué tabla apunta a cuál otra). ' +
    'Úsala para saber cómo hacer JOIN entre tablas. Si pasas table_name, filtra las relaciones de esa tabla.',
  inputSchema: {
    table_name: z.string().min(1).max(63).optional().describe('Opcional: solo relaciones de esta tabla'),
  },
  handler: async ({ table_name }) => ({ relationships: await getRelationships(table_name || null) }),
  getRelationships,
};
