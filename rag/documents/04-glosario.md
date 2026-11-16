# Glosario del negocio

## Términos que usan los usuarios
- "Venta", "orden", "compra" y "pedido" se refieren a la tabla pedidos.
- "Ingresos", "facturación" o "cuánto vendimos" = suma de pedidos.total sin anulados.
- "Ticket promedio" = monto promedio por pedido vendido.
- "Cliente nuevo" = cliente con fecha_registro en el periodo consultado.
- "Agotado" = producto con stock 0. "Descontinuado" = producto con activo = FALSE.
- "Distrito" = distrito de Lima del cliente (columna clientes.distrito).

## Moneda e impuestos
Todos los montos están en soles (PEN) e incluyen IGV (18 %). Si el usuario pide el monto sin IGV: total / 1.18.

## Estados del pedido
pendiente → pagado → enviado → entregado. Un pedido se puede anular en cualquier momento antes de ser entregado.
