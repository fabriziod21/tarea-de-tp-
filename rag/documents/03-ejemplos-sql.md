# Ejemplos de consultas SQL

## Pedidos de un cliente por DNI
Pregunta: ¿Cuántos pedidos tiene el cliente con DNI 12345678?
```sql
SELECT c.nombres, c.apellido_paterno, c.apellido_materno,
       COUNT(p.id) AS total_pedidos,
       COUNT(p.id) FILTER (WHERE p.estado = 'anulado') AS anulados
FROM clientes c
LEFT JOIN pedidos p ON p.cliente_id = c.id
WHERE c.dni = '12345678'
GROUP BY c.id;
```

## Ventas del mes actual
Pregunta: ¿Cuánto vendimos este mes?
```sql
SELECT COUNT(*) AS pedidos, SUM(total) AS ingresos
FROM pedidos
WHERE estado IN ('pagado', 'enviado', 'entregado')
  AND fecha >= date_trunc('month', CURRENT_DATE);
```

## Productos más vendidos
Pregunta: ¿Cuáles son los 5 productos más vendidos?
```sql
SELECT pr.nombre, SUM(d.cantidad) AS unidades
FROM detalle_pedido d
JOIN pedidos p ON p.id = d.pedido_id
JOIN productos pr ON pr.id = d.producto_id
WHERE p.estado IN ('pagado', 'enviado', 'entregado')
GROUP BY pr.id, pr.nombre
ORDER BY unidades DESC
LIMIT 5;
```

## Ventas por categoría
```sql
SELECT cat.nombre AS categoria, SUM(d.cantidad * d.precio_unitario) AS ingresos
FROM detalle_pedido d
JOIN pedidos p ON p.id = d.pedido_id
JOIN productos pr ON pr.id = d.producto_id
JOIN categorias cat ON cat.id = pr.categoria_id
WHERE p.estado IN ('pagado', 'enviado', 'entregado')
GROUP BY cat.nombre
ORDER BY ingresos DESC;
```

## Clientes frecuentes
```sql
SELECT c.nombres || ' ' || c.apellido_paterno AS cliente, COUNT(*) AS pedidos
FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
WHERE p.estado IN ('pagado', 'enviado', 'entregado')
GROUP BY c.id, cliente
HAVING COUNT(*) >= 5
ORDER BY pedidos DESC;
```

## Productos con stock bajo
```sql
SELECT nombre, stock FROM productos
WHERE activo AND stock < 5
ORDER BY stock;
```
