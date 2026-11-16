# Reglas de negocio

## Qué cuenta como venta
Un pedido cuenta como venta cuando su estado es pagado, enviado o entregado.
Los pedidos con estado "anulado" NUNCA se suman en ventas, ingresos ni ticket promedio.
Los pedidos "pendiente" todavía no están pagados: no son venta, pero sí se pueden contar como pedidos registrados si el usuario pregunta por "pedidos" en general.
Si el usuario pregunta "cuántos pedidos tiene un cliente" se cuentan TODOS sus pedidos (incluidos anulados) y conviene aclarar cuántos están anulados.

## Ingresos y ticket promedio
Ingresos (o "ventas en soles") = SUM(pedidos.total) de los pedidos que cuentan como venta.
Ticket promedio = AVG(pedidos.total) de los pedidos que cuentan como venta.
Los montos se expresan en soles con el formato S/ 1,234.50.

## Cliente frecuente
Un cliente frecuente es el que tiene 5 o más pedidos que cuentan como venta.

## Stock bajo
Un producto activo tiene stock bajo cuando le quedan menos de 5 unidades. Un producto con stock 0 está agotado.
Los productos con activo = FALSE están descontinuados y no deben recomendarse.

## Fechas y periodos
"Este mes" se calcula con date_trunc('month', CURRENT_DATE). "Este año" con date_trunc('year', CURRENT_DATE).
La zona horaria del negocio es America/Lima.
Cuando el usuario no indica periodo en preguntas de ventas, se usa todo el historial y se menciona en la respuesta.

## Privacidad
El DNI, email y teléfono son datos personales (Ley N.° 29733 de Protección de Datos Personales).
No se listan masivamente: solo se muestran cuando el usuario pregunta por un cliente específico.
