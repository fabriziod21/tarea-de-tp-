// Pruebas del SQL Validator:  npm test   (desde la raíz)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSQL } = require('../src/services/sqlValidator.service');

const ok = (sql) => assert.equal(validateSQL(sql).valid, true, `debería aceptar: ${sql}`);
const ko = (sql) => assert.equal(validateSQL(sql).valid, false, `debería rechazar: ${sql}`);

test('acepta SELECT y WITH normales', () => {
  ok('SELECT * FROM clientes');
  ok('select count(*) from pedidos where estado = \'entregado\'');
  ok('WITH t AS (SELECT cliente_id, COUNT(*) c FROM pedidos GROUP BY 1) SELECT * FROM t');
  ok('(SELECT 1) UNION (SELECT 2)');
});

test('acepta el ";" final que Claude suele poner', () => {
  const r = validateSQL('SELECT * FROM clientes;  ');
  assert.equal(r.valid, true);
  assert.equal(r.sql, 'SELECT * FROM clientes');
});

test('no da falsos positivos con columnas como created_at / updated_at', () => {
  ok('SELECT id, created_at, updated_at, deleted_at FROM pedidos');
  ok('SELECT fecha_registro, settlement FROM clientes OFFSET 5');
});

test('ignora palabras prohibidas dentro de textos e identificadores', () => {
  ok("SELECT * FROM pedidos WHERE estado = 'DELETE; DROP TABLE x'");
  ok('SELECT "update" FROM clientes');
  ok("SELECT 'it''s ok' AS texto");
});

test('rechaza escrituras y DDL', () => {
  ko('INSERT INTO clientes (dni) VALUES (\'1\')');
  ko('UPDATE clientes SET nombres = \'x\'');
  ko('DELETE FROM clientes');
  ko('DROP TABLE clientes');
  ko('ALTER TABLE clientes ADD COLUMN x int');
  ko('TRUNCATE pedidos');
  ko('WITH x AS (DELETE FROM pedidos RETURNING *) SELECT * FROM x');
  ko('SELECT * INTO copia FROM clientes');
  ko('SELECT * FROM pedidos FOR UPDATE');
});

test('rechaza varias sentencias y comentarios', () => {
  ko('SELECT 1; DELETE FROM clientes');
  ko('SELECT 1; SELECT 2');
  ko('SELECT 1 -- comentario');
  ko('SELECT /* x */ 1');
});

test('rechaza trucos con comillas y dollar quoting', () => {
  ko('SELECT "a\'b" FROM t; DELETE FROM t WHERE "x\'y" = 1');
  ko("SELECT $$'$$; DELETE FROM t; SELECT '$$");
  ko("SELECT 'sin cerrar");
  ko("SELECT E'\\' ; DELETE FROM t");
});

test('entiende los textos E\'...\' igual que PostgreSQL', () => {
  // Para PostgreSQL esto es UN solo texto (\' es una comilla escapada): es inofensivo
  ok("SELECT E'\\' ; DELETE FROM t ; '");
});

test('rechaza funciones peligrosas', () => {
  ko('SELECT pg_sleep(10)');
  ko("SELECT pg_read_file('/etc/passwd')");
  ko("SELECT set_config('x', 'y', false)");
  ko("SELECT query_to_xml('delete from t', true, true, '')");
});

test('rechaza SQL vacío o que no es SELECT', () => {
  ko('');
  ko(null);
  ko('   ');
  ko('EXPLAIN SELECT 1');
  ko('SHOW ALL');
});
