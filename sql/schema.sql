-- ============================================================
-- Esquema de ejemplo del negocio (tienda con clientes y pedidos)
-- Reemplázalo por las tablas de TU proyecto si ya las tienes.
-- Ejecutar con el usuario ADMINISTRADOR (no con chatbot_reader).
-- ============================================================

DROP TABLE IF EXISTS detalle_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

CREATE TABLE clientes (
  id              SERIAL PRIMARY KEY,
  dni             CHAR(8)      NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
  nombres         VARCHAR(100) NOT NULL,
  apellido_paterno VARCHAR(60) NOT NULL,
  apellido_materno VARCHAR(60),
  email           VARCHAR(120) UNIQUE,
  telefono        VARCHAR(15),
  distrito        VARCHAR(60),
  fecha_registro  DATE         NOT NULL DEFAULT CURRENT_DATE
);
COMMENT ON TABLE  clientes IS 'Clientes registrados de la tienda. Se identifican por DNI.';
COMMENT ON COLUMN clientes.dni IS 'Documento Nacional de Identidad (8 dígitos). Sirve para consultar RENIEC.';
COMMENT ON COLUMN clientes.distrito IS 'Distrito de Lima donde vive el cliente.';
COMMENT ON COLUMN clientes.fecha_registro IS 'Fecha en que el cliente se registró.';

CREATE TABLE categorias (
  id      SERIAL PRIMARY KEY,
  nombre  VARCHAR(60) NOT NULL UNIQUE
);
COMMENT ON TABLE categorias IS 'Categorías de productos (Laptops, Accesorios, etc.).';

CREATE TABLE productos (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120)  NOT NULL,
  categoria_id  INT           NOT NULL REFERENCES categorias(id),
  precio        NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  stock         INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo        BOOLEAN       NOT NULL DEFAULT TRUE
);
COMMENT ON TABLE  productos IS 'Catálogo de productos a la venta.';
COMMENT ON COLUMN productos.precio IS 'Precio de venta actual en soles (PEN), incluye IGV.';
COMMENT ON COLUMN productos.stock IS 'Unidades disponibles en almacén.';
COMMENT ON COLUMN productos.activo IS 'FALSE = producto descontinuado (no se vende).';

CREATE TABLE pedidos (
  id          SERIAL PRIMARY KEY,
  cliente_id  INT           NOT NULL REFERENCES clientes(id),
  fecha       TIMESTAMP     NOT NULL DEFAULT NOW(),
  estado      VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'entregado', 'anulado')),
  total       NUMERIC(10,2) NOT NULL DEFAULT 0
);
COMMENT ON TABLE  pedidos IS 'Pedidos (órdenes de compra) hechos por los clientes.';
COMMENT ON COLUMN pedidos.estado IS 'pendiente | pagado | enviado | entregado | anulado. Los anulados NO cuentan como venta.';
COMMENT ON COLUMN pedidos.total IS 'Monto total del pedido en soles = suma de cantidad * precio_unitario del detalle.';

CREATE TABLE detalle_pedido (
  id               SERIAL PRIMARY KEY,
  pedido_id        INT           NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id      INT           NOT NULL REFERENCES productos(id),
  cantidad         INT           NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);
COMMENT ON TABLE  detalle_pedido IS 'Líneas de cada pedido: qué producto, cuántas unidades y a qué precio.';
COMMENT ON COLUMN detalle_pedido.precio_unitario IS 'Precio al momento de la compra (puede diferir del precio actual del producto).';

CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_fecha   ON pedidos(fecha);
CREATE INDEX idx_detalle_pedido  ON detalle_pedido(pedido_id);
