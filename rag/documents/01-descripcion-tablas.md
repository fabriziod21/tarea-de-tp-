# Descripción de las tablas del negocio

## Tabla clientes
Guarda a las personas registradas en la tienda. Cada cliente se identifica por su DNI (8 dígitos, columna `dni`, única).
Columnas importantes: `nombres`, `apellido_paterno`, `apellido_materno`, `email`, `telefono`, `distrito` (distrito de Lima donde vive) y `fecha_registro`.
Para mostrar el nombre completo se concatena: `nombres || ' ' || apellido_paterno || ' ' || COALESCE(apellido_materno, '')`.
Cuando el usuario pregunta "¿quién es el cliente con DNI X?" se busca en `clientes.dni`; si además se quiere validar la identidad oficial se usa la herramienta de RENIEC.

## Tabla pedidos
Cada fila es una orden de compra de un cliente (`cliente_id` → `clientes.id`).
`fecha` es un TIMESTAMP con la fecha y hora del pedido. `total` es el monto en soles (PEN) y ya incluye IGV.
`estado` puede ser: pendiente, pagado, enviado, entregado o anulado.

## Tabla detalle_pedido
Las líneas de cada pedido: qué producto (`producto_id` → `productos.id`), cuántas unidades (`cantidad`) y el `precio_unitario` cobrado en ese momento.
El precio del detalle puede ser distinto del precio actual del producto, porque los precios cambian con el tiempo.
Para calcular unidades vendidas de un producto se suma `detalle_pedido.cantidad`.

## Tabla productos
Catálogo de productos. `precio` es el precio de venta ACTUAL en soles, `stock` las unidades disponibles y `activo = FALSE` indica un producto descontinuado.
Cada producto pertenece a una categoría (`categoria_id` → `categorias.id`).

## Tabla categorias
Nombres de las categorías: Laptops, Monitores, Accesorios, Componentes y Audio.

## Relaciones (JOINs habituales)
- pedidos.cliente_id = clientes.id
- detalle_pedido.pedido_id = pedidos.id
- detalle_pedido.producto_id = productos.id
- productos.categoria_id = categorias.id
