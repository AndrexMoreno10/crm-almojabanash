# Inventario y seguimiento en el embudo

## Catálogo inicial

Se registran una sola vez los 40 productos de la carta compartida por el usuario: 13 comestibles y 27 bebidas. La línea «Premio, Sprite» se separa en dos productos. Los nombres y categorías son editables. No se asignan códigos comerciales, precios, monedas, presentaciones, unidades, mínimos ni cantidades que el usuario no haya confirmado.

Un precio vacío significa **Por definir**; no se interpreta como gratuito. Las existencias empiezan como **Sin registrar**; no se interpretan como cero. El catálogo se carga mediante una migración registrada para conservar correcciones, productos archivados y movimientos en los siguientes arranques. Los contactos, notas, fechas y logo existentes se conservan.

## Uso

1. Abrir **Inventario** en el sidebar. Sustituye a la antigua sección independiente de Seguimientos.
2. Editar cada producto para indicar presentación, unidad, moneda y precios conocidos. Hay precios al detal y mayoristas y un costo opcional por unidad de control. Pueden dejarse vacíos.
3. Registrar el **Conteo inicial** real del producto. Si aún no tiene unidad, se solicita en ese movimiento. Un conteo explícito de cero sí representa un producto agotado.
4. Registrar compras, producción, ventas, devoluciones recibidas, mermas o ajustes de entrada/salida. Cada movimiento exige cantidad y motivo y admite una referencia. Las ventas y devoluciones pueden relacionarse con un contacto del CRM.
5. Consultar los movimientos con fecha, tipo, cantidad, unidad y saldo posterior; filtrar por producto y recorrer el historial paginado.
6. Definir mínimos para detectar stock bajo. Buscar y filtrar el catálogo por categoría, existencias o productos archivados. El CSV exporta los productos filtrados con sus precios y existencias.

El producto se archiva cuando no tiene existencias o todavía no se ha hecho el conteo. Puede reactivarse después. No se eliminan movimientos: los errores se corrigen mediante un ajuste con su motivo. Una presentación con unidad distinta se registra como otro producto; cambiar la unidad de un producto con movimientos alteraría el significado de su historial y se rechaza.

## Reglas de integridad

- Cantidades con hasta tres decimales; precios con hasta dos. Se almacenan internamente como enteros escalados para evitar errores de coma flotante en los saldos.
- El conteo inicial se registra una sola vez. Los movimientos posteriores requieren ese conteo.
- Una salida no puede superar las existencias. El saldo y su movimiento se guardan en una misma transacción, también ante peticiones simultáneas.
- Cada movimiento lleva un identificador de operación. Reintentar exactamente la misma petición devuelve su resultado, sin volver a aplicar la cantidad. Usar ese identificador con datos distintos se rechaza.
- Código único cuando se especifica; nombre y presentación únicos entre productos activos. Las presentaciones distintas admiten el mismo nombre base.
- Editar precios y datos del catálogo conserva las existencias. Archivar conserva los movimientos y no oculta stock positivo.
- Una venta registrada en inventario no mueve automáticamente al lead a Primera compra. Un cambio de etapa no descuenta unidades.

## Seguimiento dentro del embudo

La sección de agenda se retira del sidebar y sus enlaces antiguos abren el embudo. Las fechas del siguiente contacto permanecen en las fichas y tarjetas. Las colas del Resumen mantienen acceso a las conversaciones pendientes.

El color de seguimiento se registra por separado de la etapa comercial, la fecha y la revisión del lead:

| Color    | Etiqueta indicada por el usuario |
| -------- | -------------------------------- |
| Verde    | Disponible                       |
| Amarillo | Pendiente                        |
| Rojo     | No interesado                    |
| Neutro   | Sin marcar                       |

Los leads existentes empiezan sin marcar. Elegir un color desde la tarjeta o la ficha registra el cambio en su historial. El rojo no marca automáticamente una oportunidad como perdida ni detiene por sí solo el bot. El punto azul/doble chulo conserva su significado independiente de revisión dentro del CRM.

## Decisiones comerciales pendientes

- Qué significa «Disponible» en la operación comercial: interesado/listo para avanzar o atendido/sin pendientes. Se conserva de momento la palabra usada por el usuario.
- Presentación y unidad de cada producto, existencias iniciales, precios vigentes y mínimos.
- Si se manejarán productos listos, congelados, ingredientes o varios de ellos; recetas, rendimientos y consumo de materias primas.
- Si se requiere control por lote, fecha de vencimiento y rotación. La versión actual controla saldo por producto, sin asignación de lotes.
- Momento de descontar automáticamente un pedido y tratamiento de reservas, cancelaciones y devoluciones. Hoy los movimientos son explícitos y manuales.
- Costos y proveedores, ubicaciones internas o bodegas, y roles autorizados para registrar ajustes.

El registro de producción añade existencias del producto terminado; todavía no consume ingredientes por receta. No se calculan impuestos, utilidad, costo promedio, cartera ni facturas. Estas reglas requieren datos del negocio y no se infieren de la carta.

## Verificación

Las pruebas de API cubren migración, conservación de datos, conteo, exactitud decimal, entradas y salidas, reintentos, concurrencia, precios, archivo, filtros, paginación y rechazo de cambios inválidos. Las pruebas en Chromium recorren edición de precios, conteo, venta, stock bajo, historial, CSV, archivo/reactivación y móvil, con revisión automática de accesibilidad mediante axe.
