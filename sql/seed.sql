-- ============================================================
-- Datos de prueba (ficticios). Ejecutar DESPUÉS de schema.sql
-- con el usuario ADMINISTRADOR.
-- El cliente con DNI 12345678 tiene 7 pedidos: es el ejemplo
-- del Módulo 7 de la guía.
-- ============================================================

INSERT INTO clientes (dni, nombres, apellido_paterno, apellido_materno, email, telefono, distrito, fecha_registro) VALUES
('12345678', 'Juan',            'Pérez',     'García',   'juan.perez@correo.pe',      '987654321', 'Miraflores',              '2025-03-10'),
('40112233', 'María Fernanda',  'Quispe',    'Huamán',   'maria.quispe@correo.pe',    '987100200', 'San Isidro',              '2025-04-02'),
('41223344', 'Carlos Alberto',  'Rojas',     'Mendoza',  'carlos.rojas@correo.pe',    '987100201', 'Santiago de Surco',       '2025-05-18'),
('42334455', 'Lucía',           'Torres',    'Vargas',   'lucia.torres@correo.pe',    '987100202', 'Los Olivos',              '2025-06-21'),
('43445566', 'Diego',           'Ramírez',   'Salazar',  'diego.ramirez@correo.pe',   '987100203', 'San Borja',               '2025-07-09'),
('44556677', 'Ana Sofía',       'Castillo',  'Rivas',    'ana.castillo@correo.pe',    '987100204', 'La Molina',               '2025-08-15'),
('45667788', 'Jorge Luis',      'Chávez',    'Paredes',  'jorge.chavez@correo.pe',    '987100205', 'Jesús María',             '2025-09-01'),
('46778899', 'Valeria',         'Gutiérrez', 'Flores',   'valeria.gutierrez@correo.pe','987100206','Barranco',                '2025-10-12'),
('47889900', 'Renzo',           'Mendoza',   'Aguilar',  'renzo.mendoza@correo.pe',   '987100207', 'San Miguel',              '2025-11-30'),
('48990011', 'Camila',          'Herrera',   'Ríos',     'camila.herrera@correo.pe',  '987100208', 'Magdalena del Mar',       '2026-01-08'),
('70011223', 'Andrés',          'Silva',     'Campos',   'andres.silva@correo.pe',    '987100209', 'Surquillo',               '2026-02-14'),
('70122334', 'Fiorella',        'Vásquez',   'León',     'fiorella.vasquez@correo.pe','987100210', 'Pueblo Libre',            '2026-03-03'),
('70233445', 'Miguel Ángel',    'Núñez',     'Soto',     'miguel.nunez@correo.pe',    '987100211', 'Chorrillos',              '2026-04-27'),
('70344556', 'Daniela',         'Paz',       'Ortiz',    'daniela.paz@correo.pe',     '987100212', 'Lince',                   '2026-06-19'),
('70455667', 'Sebastián',       'Ruiz',      'Cárdenas', 'sebastian.ruiz@correo.pe',  '987100213', 'San Juan de Lurigancho',  '2026-09-05');

INSERT INTO categorias (nombre) VALUES
('Laptops'), ('Monitores'), ('Accesorios'), ('Componentes'), ('Audio');

INSERT INTO productos (nombre, categoria_id, precio, stock, activo) VALUES
('Laptop Lenovo IdeaPad 5 14"',        1, 3299.00,  12, TRUE),
('Laptop ASUS Vivobook 15',            1, 2499.00,   8, TRUE),
('Laptop HP Pavilion 14 (2024)',       1, 2799.00,   0, FALSE),
('Monitor LG 27" IPS 4K',              2, 1599.00,  15, TRUE),
('Monitor Samsung 24" 144Hz',          2,  899.00,  20, TRUE),
('Mouse inalámbrico Logitech M720',    3,  189.00,  60, TRUE),
('Teclado mecánico Redragon K552',     3,  219.00,  35, TRUE),
('Mochila para laptop 15.6"',          3,  129.00,  40, TRUE),
('Hub USB-C 7 en 1',                   3,  159.00,  25, TRUE),
('SSD NVMe Kingston 1TB',              4,  329.00,  30, TRUE),
('Memoria RAM DDR4 16GB',              4,  239.00,  45, TRUE),
('Tarjeta gráfica RTX 4060 8GB',       4, 1449.00,   5, TRUE),
('Audífonos Sony WH-1000XM5',          5, 1399.00,   9, TRUE),
('Parlante JBL Flip 6',                5,  499.00,  18, TRUE),
('Micrófono USB HyperX SoloCast',      5,  249.00,  14, TRUE),
('Webcam Logitech C920',               3,  299.00,   3, TRUE);

-- 7 pedidos del cliente de ejemplo (DNI 12345678)
INSERT INTO pedidos (cliente_id, fecha, estado) VALUES
(1, '2026-01-15 10:24', 'entregado'),
(1, '2026-03-02 18:05', 'entregado'),
(1, '2026-05-20 12:40', 'entregado'),
(1, '2026-07-11 09:15', 'anulado'),
(1, '2026-09-03 20:31', 'entregado'),
(1, '2026-10-28 16:02', 'enviado'),
(1, '2026-11-12 11:47', 'pagado');

-- 48 pedidos del resto de clientes (generados de forma determinística)
INSERT INTO pedidos (cliente_id, fecha, estado)
SELECT
  2 + ((g * 7) % 14),
  TIMESTAMP '2026-01-02 09:00' + ((g * 37) % 315) * INTERVAL '1 day' + ((g * 5) % 11) * INTERVAL '1 hour',
  CASE
    WHEN g % 10 = 0 THEN 'anulado'
    WHEN g % 7  = 0 THEN 'pendiente'
    WHEN g % 5  = 0 THEN 'pagado'
    WHEN g % 4  = 0 THEN 'enviado'
    ELSE 'entregado'
  END
FROM generate_series(1, 48) AS g;

-- Detalle: entre 1 y 3 productos por pedido
INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
SELECT p.id,
       1 + ((p.id * 3 + n * 5) % 16) AS producto_id,
       1 + ((p.id + n) % 3)          AS cantidad,
       pr.precio
FROM pedidos p
CROSS JOIN generate_series(0, 2) AS n
JOIN productos pr ON pr.id = 1 + ((p.id * 3 + n * 5) % 16)
WHERE n <= (p.id % 3);

-- Total de cada pedido = suma del detalle
UPDATE pedidos p
SET total = d.suma
FROM (
  SELECT pedido_id, SUM(cantidad * precio_unitario) AS suma
  FROM detalle_pedido
  GROUP BY pedido_id
) d
WHERE d.pedido_id = p.id;
