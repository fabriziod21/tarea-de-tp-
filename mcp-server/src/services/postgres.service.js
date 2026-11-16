// mcp-server/src/services/postgres.service.js
// Acceso a PostgreSQL usado por las herramientas del MCP Server.
const { pool } = require('../config/database');
const { validateSQL } = require('./sqlValidator.service');

const MAX_ROWS = Number(process.env.SQL_MAX_ROWS || 100);
const STATEMENT_TIMEOUT_MS = Number(process.env.SQL_TIMEOUT_MS || 10000);

class SqlRejectedError extends Error {
  constructor(reason) {
    super(`SQL rechazado: ${reason}`);
    this.name = 'SqlRejectedError';
    this.reason = reason;
  }
}

/** Consulta de metadatos (parametrizada, la escribimos nosotros, no Claude). */
async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

/**
 * Ejecuta un SQL generado por Claude con tres capas de seguridad:
 *   1. SQL Validator (solo un SELECT, sin palabras ni funciones prohibidas)
 *   2. Transacción READ ONLY con timeout
 *   3. Usuario chatbot_reader (solo tiene permiso SELECT)
 * Además limita el resultado a MAX_ROWS filas, tenga o no LIMIT.
 */
async function runReadOnly(sql) {
  const validation = validateSQL(sql);
  if (!validation.valid) {
    throw new SqlRejectedError(validation.reason);
  }

  // Envolver la consulta garantiza el tope de filas aunque Claude
  // haya puesto un LIMIT 100000. Pedimos una fila extra para saber
  // si el resultado se recortó.
  const executedSql = `SELECT * FROM (\n${validation.sql}\n) AS consulta LIMIT ${MAX_ROWS + 1}`;

  const client = await pool.connect();
  const start = Date.now();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(executedSql);
    await client.query('COMMIT');

    const truncated = result.rows.length > MAX_ROWS;
    const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;

    return {
      rows,
      rowCount: rows.length,
      truncated,
      columns: result.fields.map((f) => f.name),
      durationMs: Date.now() - start,
      sql: validation.sql,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, runReadOnly, SqlRejectedError, MAX_ROWS };
