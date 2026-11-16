-- sql/demo_profesor.sql
-- Consultas para mostrar la base de datos en vivo desde VS Code (extensión PostgreSQL).
-- Conecta el archivo a un perfil ("Chatbot · admin" o "chatbot_reader"), selecciona una
-- consulta y ejecútala con el botón ▶ (Run Query) de arriba a la derecha del editor.

-- 1. Las tablas del negocio y cuántos registros tiene cada una
SELECT 'clientes' AS tabla, COUNT(*) AS registros FROM clientes
UNION ALL SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL SELECT 'productos', COUNT(*) FROM productos
UNION ALL SELECT 'pedidos', COUNT(*) FROM pedidos
UNION ALL SELECT 'detalle_pedido', COUNT(*) FROM detalle_pedido;

-- 2. El cliente de la demo (DNI 12345678) y sus pedidos
SELECT c.nombres, c.apellido_paterno, c.apellido_materno, c.dni, p.id AS pedido, p.fecha, p.estado, p.total
FROM clientes c
JOIN pedidos p ON p.cliente_id = c.id
WHERE c.dni = '12345678'
ORDER BY p.fecha;

-- 3. Relaciones entre tablas (llaves foráneas)
SELECT tc.table_name AS tabla, kcu.column_name AS columna, ccu.table_name AS referencia
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tabla;

-- 4. Permisos del usuario del chatbot: solo SELECT
SELECT table_name AS tabla, string_agg(privilege_type, ', ') AS permisos
FROM information_schema.role_table_grants
WHERE grantee = 'chatbot_reader'
GROUP BY table_name
ORDER BY tabla;

-- 5. PRUEBA DE SEGURIDAD: conéctate como "chatbot_reader (solo lectura)" y ejecuta estas 3 líneas.
--    PostgreSQL rechaza el DELETE: "cannot execute DELETE in a read-only transaction".
--    El ROLLBACK final deshace todo, así que aunque lo ejecutes como admin no se borra nada.
BEGIN;
DELETE FROM pedidos WHERE estado = 'anulado';
ROLLBACK;
