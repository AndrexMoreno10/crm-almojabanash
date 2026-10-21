# Propuesta: ventas y arqueo de caja

Estado: diseño pendiente de confirmar reglas operativas. Este documento no implementa ventas, pagos ni cierres. Complementa el inventario existente.

## Objetivo y referencia

El usuario solicita evaluar funciones de monday CRM y reemplazar el registro manual de ventas en papel con arqueo de caja. Se intentó consultar la página compartida y su centro de ayuda el 21 de octubre de 2026; el entorno rechazó ambas conexiones con HTTP 403. No se verificaron funciones, planes, precios ni integraciones actuales de monday. Las siguientes prioridades corresponden al negocio y al código existente, no a una auditoría del producto externo.

## Prioridades para este CRM

| Capacidad | Situación actual | Siguiente mejora propuesta |
| --- | --- | --- |
| Embudo y ficha del cliente | Ocho etapas, notas, historial, responsable, próxima fecha y seguimiento por color | Mostrar pedidos, pagos y frecuencia real de compras en la ficha |
| Atención de leads | Revisión dentro del CRM y enlace manual a WhatsApp; adaptador de Cloud API preparado | Conectar Meta y medir primera respuesta real; abrir conversaciones pendientes desde el resumen |
| Automatización comercial | Simulador y flujo de calificación; conexión real pendiente | Recordatorios internos y tareas según fechas; mensajes externos sujetos a consentimiento y reglas de Meta |
| Catálogo y existencias | 40 productos; precios editables, conteo inicial e historial de movimientos | Vincular cada salida a una venta y evitar descontar dos veces |
| Ventas y cobros | No implementados; una salida de inventario no registra dinero | Registrar productos, precios acordados, cliente opcional, pagos y saldo |
| Caja | No implementada | Apertura, movimientos, arqueo y cierre con diferencia |
| Indicadores | Etapas y atención del CRM | Conversión a compra registrada, recompra, tiempos de atención y cobros por medio de pago |

Orden recomendado: acordar operación de caja, implementar ventas y cobros conectados al inventario, implementar arqueo y cierre, y completar conexión de Meta/medición comercial. La conexión de Meta puede avanzar en paralelo cuando existan cuenta y alojamiento adecuados.

## Navegación y operación propuestas

Añadir una sección **Ventas y caja** con tres vistas internas: **Nueva venta**, **Ventas** y **Caja**. Mantener el seguimiento comercial en el embudo y el inventario en su sección actual.

- **Nueva venta:** buscar productos, agregar cantidades y precio acordado, ver total y registrar el cobro. Cliente opcional para venta de mostrador; vinculado al contacto cuando se conozca. Precios pendientes requieren un valor explícito antes de confirmar: vacío no equivale a gratuito.
- **Ventas:** consultar fecha, referencia, cliente cuando exista, productos, total, estado de entrega, cobrado y saldo; acceder al detalle y a las correcciones.
- **Caja:** apertura con base real, ingresos y egresos identificados, efectivo esperado, conteo físico y cierre. Mostrar pagos digitales por separado para conciliarlos con sus comprobantes.

No exigir crear un lead por cada compra anónima del local. Conservar el canal del pedido separado del canal de origen del lead y del medio de pago: una compra que nació en WhatsApp puede pagarse en efectivo.

## Qué significa un arqueo

El arqueo compara el efectivo contado con el que debería haber. El cierre fija ese resultado al terminar el período de caja. Contar dinero no debería cerrar la caja automáticamente.

**Efectivo esperado = base inicial + cobros en efectivo + otros ingresos en efectivo − devoluciones pagadas en efectivo − gastos y retiros en efectivo.**

**Diferencia = efectivo contado − efectivo esperado.**

Una diferencia negativa es faltante; positiva, sobrante. Registrar la explicación y conservar los valores originales, sin crear ajustes automáticos que oculten la diferencia.

Ejemplo exclusivamente ilustrativo: base $100.000 + cobros $300.000 − gastos $40.000 = esperado $360.000. Si se cuentan $350.000, hay un faltante de $10.000. Una transferencia de $80.000 se muestra entre cobros digitales y no aumenta el efectivo del cajón.

Separar venta, entrega y pago. Una venta a crédito no aporta efectivo hasta su cobro; un cobro de deuda anterior afecta la caja actual sin ser una venta nueva. Un anticipo tampoco equivale por sí solo a un pedido entregado. Aplicar estas operaciones solo si el negocio confirma que las utiliza.

## Reglas necesarias para una implementación confiable

- Guardar los precios acordados dentro de cada venta: editar el catálogo después no altera ventas pasadas.
- Registrar importes con precisión decimal controlada y moneda explícita. No inferir impuestos, descuentos, propinas ni recargos.
- Relacionar venta, pago y movimiento de inventario mediante identificadores; una misma operación reintentada no debe duplicar cobros ni descontar stock dos veces.
- Definir cuándo se descuenta el producto: confirmar venta, entregar pedido u otra regla aprobada. La etapa del lead no debe descontarlo por sí sola.
- Distinguir devolución de dinero de devolución física: reintegrar stock solo cuando corresponda al producto efectivamente recibido y utilizable.
- Conservar anulaciones y correcciones con motivo, fecha y autor. Un cierre confirmado debe preservar su historial; no editar ni borrar movimientos silenciosamente.
- Mostrar totales por medio de pago; los pagos digitales requieren conciliación, no se consideran verificados automáticamente.
- Registrar quién abre, opera, cuenta y revisa. Definir identificación y permisos antes de utilizar cierres con varios operadores; el CRM actual no implementa autenticación ni roles.
- Permitir consultar/exportar el cierre con base, cobros, egresos, efectivo esperado, contado y diferencia. No presentar este comprobante interno como factura electrónica.
- Separar operación comercial de contabilidad formal; utilidad requiere costos y reglas que aún no se han confirmado.

## Resumen principal propuesto

Conservar una pantalla compacta orientada a acciones: leads pendientes de atención, contactos que toca retomar y oportunidades por cerrar. Cuando existan ventas registradas, añadir un resumen pequeño de ventas y cobros del período, con acceso a Ventas y caja. No mezclar ventas estimadas del embudo con ventas registradas ni cobros reales.

## Preguntas enviadas al usuario

1. ¿Se registran ventas del local, WhatsApp y mayoristas? ¿Hay fiado o anticipos?
2. ¿Qué medios de pago se utilizan? ¿Se pagan proveedores, gastos o retiros del dueño con efectivo de caja?
3. ¿El cierre es diario o por turno/cajero? ¿Se deja base para dar cambio y quién revisa el cierre?

Luego concretar el momento de salida de inventario, manejo de entregas y devoluciones, precios mayoristas, impuestos si aplican y necesidad de comprobantes impresos/facturación. No inventar datos históricos: definir una fecha de inicio con conteo físico y base real, o una importación identificada si el negocio decide transcribir el papel.
