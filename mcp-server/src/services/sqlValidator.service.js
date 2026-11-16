// mcp-server/src/services/sqlValidator.service.js
//
// Primera capa de seguridad: solo deja pasar UNA consulta SELECT.
// (Las otras dos capas son el usuario chatbot_reader y la transacción
// READ ONLY con la que se ejecuta cada consulta.)
//
// Correcciones respecto a la guía:
//  - Busca palabras COMPLETAS (\bDELETE\b), no subcadenas: antes una columna
//    "created_at" o "updated_at" hacía rechazar la consulta.
//  - Ignora lo que está dentro de textos ('...') e identificadores ("..."),
//    así WHERE estado = 'anulado' o un nombre con "update" no dan falsos positivos.
//  - Acepta el ";" final que Claude suele poner, pero sigue bloqueando
//    varias sentencias.

const MAX_SQL_LENGTH = 5000;

// Palabras que nunca deben aparecer en una consulta de lectura
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT', 'DROP', 'ALTER', 'TRUNCATE',
  'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC', 'CALL', 'DO', 'COPY', 'INTO',
  'LOCK', 'VACUUM', 'ANALYZE', 'REINDEX', 'CLUSTER', 'REFRESH', 'COMMENT',
  'LISTEN', 'NOTIFY', 'UNLISTEN', 'PREPARE', 'DEALLOCATE', 'DISCARD', 'RESET',
  'SET', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'IMPORT', 'LOAD',
];

// Funciones peligrosas aunque estén dentro de un SELECT
const FORBIDDEN_FUNCTIONS = [
  'pg_sleep', 'pg_sleep_for', 'pg_sleep_until',
  'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
  'pg_terminate_backend', 'pg_cancel_backend', 'pg_reload_conf', 'pg_rotate_logfile',
  'lo_import', 'lo_export', 'lo_get', 'lo_put', 'lo_from_bytea',
  'dblink', 'dblink_exec', 'dblink_connect',
  'set_config', 'query_to_xml', 'query_to_xml_and_xmlschema', 'cursor_to_xml',
];

const KEYWORD_RE = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i');
const FUNCTION_RE = new RegExp(`\\b(${FORBIDDEN_FUNCTIONS.join('|')})\\s*\\(`, 'i');

/**
 * Recorre el SQL carácter por carácter y reemplaza el contenido de los
 * textos por '' y el de los identificadores entre comillas por "_".
 * Devuelve null si hay comillas sin cerrar.
 */
function maskLiterals(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];

    if (ch === "'") {
      // E'...' permite escapes con barra invertida
      const prev = sql[i - 1] || '';
      const beforePrev = sql[i - 2] || '';
      const isEscapeString = /[eE]/.test(prev) && !/[A-Za-z0-9_]/.test(beforePrev);
      i++;
      let closed = false;
      while (i < sql.length) {
        if (isEscapeString && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; } // '' = comilla escapada
          closed = true;
          i++;
          break;
        }
        i++;
      }
      if (!closed) return null;
      out += "''";
      continue;
    }

    if (ch === '"') {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { i += 2; continue; }
          closed = true;
          i++;
          break;
        }
        i++;
      }
      if (!closed) return null;
      out += '"_"';
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Valida que el SQL sea una única consulta de lectura.
 * @param {string} sql
 * @returns {{ valid: true, sql: string } | { valid: false, reason: string }}
 *          En el caso válido, `sql` es la consulta normalizada (sin ";" final).
 */
function validateSQL(sql) {
  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return { valid: false, reason: 'SQL vacío o inválido' };
  }
  if (sql.length > MAX_SQL_LENGTH) {
    return { valid: false, reason: `El SQL supera ${MAX_SQL_LENGTH} caracteres` };
  }

  // Quitar espacios y los ";" finales (Claude casi siempre termina con ";")
  const normalized = sql.trim().replace(/[\s;]+$/, '');

  const code = maskLiterals(normalized);
  if (code === null) {
    return { valid: false, reason: 'Hay comillas sin cerrar' };
  }

  if (code.includes('--') || code.includes('/*')) {
    return { valid: false, reason: 'No se permiten comentarios en el SQL' };
  }

  if (code.includes(';')) {
    return { valid: false, reason: 'No se permiten múltiples sentencias SQL' };
  }

  // $$...$$ (dollar quoting) y parámetros $1 no tienen uso en consultas de lectura
  if (code.includes('$')) {
    return { valid: false, reason: 'No se permite el carácter $ en el SQL' };
  }

  // Debe empezar con SELECT o WITH (se permiten paréntesis iniciales)
  const start = code.replace(/^[\s(]+/, '').toUpperCase();
  if (!start.startsWith('SELECT') && !start.startsWith('WITH')) {
    return { valid: false, reason: 'Solo se permiten consultas SELECT' };
  }

  const keyword = code.match(KEYWORD_RE);
  if (keyword) {
    return { valid: false, reason: `Contiene palabra prohibida: ${keyword[1].toUpperCase()}` };
  }

  const fn = code.match(FUNCTION_RE);
  if (fn) {
    return { valid: false, reason: `Usa una función no permitida: ${fn[1]}` };
  }

  return { valid: true, sql: normalized };
}

module.exports = { validateSQL, maskLiterals, FORBIDDEN_KEYWORDS, FORBIDDEN_FUNCTIONS };
