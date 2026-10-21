# Contexto y decisiones

## Confirmado por el cliente del proyecto

- Llega tráfico desde campañas de Meta hacia WhatsApp.
- Se busca atender compradores al por mayor, hoteles, eventos y personas que revenden el producto.
- Las consultas frecuentes incluyen ubicación y venta al por mayor.
- Se quiere ofrecer una ruta de solicitud de muestras y dar seguimiento hasta el inicio de pedidos.
- El foco inicial es seguimiento y conversión comercial; gestionar comentarios y otras funciones de redes puede venir después.
- El creador del proyecto y posiblemente Aura o el administrador utilizarán el CRM. Los roles se definirán más adelante.

## Recorrido inicial implementado

1. El mensaje de WhatsApp crea o identifica una oportunidad por cuenta y remitente. Los reintentos del mismo evento no la duplican.
2. El asistente solicita permiso para seguir recopilando datos y hacer seguimiento.
3. Recoge tipo de comprador, cantidad aproximada, ciudad y nombre.
4. Pregunta si quiere solicitar una muestra, aclarando que su disponibilidad, costo y entrega necesitan confirmación del equipo.
5. Guarda los datos en la conversación y deja atención humana pendiente en la agenda.
6. La persona del equipo puede registrar notas, programar el siguiente contacto y actualizar la etapa.
7. Las consultas sobre condiciones desconocidas se entregan al equipo; no reciben datos comerciales inventados.
8. `ASESOR` pausa el asistente. `SALIR` cancela borradores pendientes y elimina el seguimiento programado. No se envía una nueva secuencia sin volver a solicitar permiso.

La calificación se puede probar íntegramente en el simulador. El adaptador real no puede validarse contra Meta hasta conectar una cuenta y publicar un webhook HTTPS.

## Pendiente de confirmar

- Nombre exacto del producto principal: la voz fue transcrita como «almohadas»; el proyecto se llama almojábanas. No usar esa transcripción en respuestas comerciales.
- Ciudad, dirección, cobertura y horarios.
- Catálogo, precios, mínimos, disponibilidad, pagos y condiciones de entrega.
- Quién aprueba muestras, qué datos requiere y si tienen costo.
- Momento exacto para considerar ganada una oportunidad: se habló de empezar a pedir producto; falta confirmar si cuenta el primer pedido confirmado o pagado.
- Número actual en WhatsApp Business o acceso existente a Cloud API; acceso administrador al negocio y a una app de Meta.
- Frecuencia, horarios y límites de los seguimientos; política de tratamiento de datos y retención que aplicará al negocio.
- Responsable y plazo de atención humana. La aplicación no promete tiempos de respuesta.

## Métricas de esta versión

- Oportunidades abiertas: todas salvo ganadas y perdidas.
- Valor en oportunidades: suma de valores estimados manuales de las abiertas. No es ingreso ni tiene moneda inferida.
- Tasa de cierre: ganadas / (ganadas + perdidas). Muestra el número de cierres que la respalda; sin cierres muestra un guion.
- Seguimientos vencidos: abiertas con una fecha anterior al momento actual.

Antes de afirmar una mejora de resultados deben medirse los contactos por campaña y período, tiempo de primera atención, solicitudes y entregas de muestras, primeros pedidos y sus definiciones de cierre. La versión actual no importa estadísticas ni atribución de anuncios y no sustituye esa medición.
