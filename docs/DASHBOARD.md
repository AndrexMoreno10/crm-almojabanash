# Inicio orientado a ventas

El Resumen responde una pregunta: **¿a quién debemos contactar ahora?** Tiene una sola lista, organizada en tres vistas. Muestra hasta seis leads y permite abrir la lista completa o el detalle de cada contacto.

Al entrar elige una vista con trabajo: primero Por atender, después seguimientos vencidos, oportunidades en cierre y el resto de seguimientos. Si el usuario cambia de pestaña, conserva esa elección mientras permanezca en el inicio.

| Vista        | Qué incluye                                                                                                                                                     | Orden                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Por atender  | Leads en Nuevo lead y fichas sin revisar en el CRM, salvo perdidas. Un mismo lead aparece una sola vez.                                                         | Primero los que llegaron antes.                      |
| Seguimientos | Contactos con fecha programada, incluidos compradores existentes; también conversaciones abiertas posteriores a Nuevo lead que todavía no tienen próxima fecha. | Vencidos, programados para hoy, sin fecha y futuros. |
| Por cerrar   | Leads clasificados en Pedido en cierre.                                                                                                                         | Prioridad a los seguimientos vencidos o para hoy.    |

Cada fila muestra nombre, canal, etapa y siguiente gestión, con su fecha cuando existe. Abrir la ficha permite responder manualmente por WhatsApp, registrar el resultado y programar la próxima fecha. Las gestiones sugeridas no envían mensajes ni confirman pedidos automáticamente.

El acceso **Sin revisar en CRM** conserva la lista de fichas pendientes. Abrir una ficha registra su revisión; no confirma una respuesta al cliente ni cambia la etapa. Los mensajes nuevos recibidos vuelven a requerir revisión, incluso con el mismo timestamp. Un borrador no cuenta como mensaje enviado. Esto no representa recibos de lectura de WhatsApp; Meta sigue sin conectar.

Los leads anteriores a esta función aparecen sin revisar cuando no existe registro de apertura. La revisión se conserva en `lead_reviews`, separada de etapas, notas y fechas comerciales.

## Resultados en segundo plano

Una línea breve muestra los leads actualmente en Primera compra y Cliente recurrente. No se suman como si fueran pedidos ni se muestran ingresos estimados. Se retiraron las tarjetas grandes de indicadores, la tasa de cierre, el valor estimado, el gráfico de distribución y la tabla de contactos recientes del inicio. Las ocho etapas y los contactos completos siguen disponibles en el embudo y las fichas.

Inventario queda fuera de esta versión. Los precios y condiciones de muestras siguen pendientes de aprobación.
