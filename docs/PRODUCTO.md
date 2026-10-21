# Contexto y decisiones

## Confirmado por el cliente del proyecto

- Llega tráfico desde campañas de Meta hacia WhatsApp.
- Se busca atender compradores al por mayor, hoteles, eventos y personas que revenden el producto.
- Las consultas frecuentes incluyen ubicación y venta al por mayor.
- Se quiere ofrecer una ruta de solicitud de muestras y dar seguimiento hasta el inicio de pedidos.
- El foco inicial es seguimiento y conversión comercial; gestionar comentarios y otras funciones de redes puede venir después.
- El creador del proyecto y posiblemente Aura o el administrador utilizarán el CRM. Los roles se definirán más adelante.

## Datos comerciales confirmados

- Producto principal: **Almojábanas Huilenses**.
- Única sede: **Cra. 14 #11-56, media cuadra arriba del parque Sucre, Armenia, Quindío**.
- Contacto público: **3152457853**.
- Municipios indicados: Armenia, Buenavista, Calarcá, Circasia, Filandia, Montenegro, Salento y La Tebaida.
- «Armenia +35 km» y «Filandia más de 2 km» son segmentación de anuncios, confirmado por el usuario. No son radios de entrega y no se usan para prometer cobertura adicional.
- El número actual usa WhatsApp Business; el usuario indicó que no tiene Cloud API. El seguimiento puede hacerse manualmente y la automatización oficial requiere la API. WhatsApp Flows es una función distinta.

## Recorrido inicial implementado

1. El mensaje de WhatsApp crea o identifica una oportunidad por cuenta y remitente. Los reintentos del mismo evento no la duplican.
2. El asistente solicita permiso para seguir recopilando datos y hacer seguimiento.
3. Recoge tipo de comprador, cantidad aproximada, ciudad y nombre.
4. Pregunta si quiere solicitar una muestra, aclarando que su disponibilidad, costo y entrega necesitan confirmación del equipo.
5. Guarda los datos en la conversación y deja atención humana pendiente en la agenda.
6. La persona del equipo puede registrar notas, programar el siguiente contacto y actualizar la etapa.
7. El bot responde la ubicación y la lista confirmada de municipios sin perder el paso de calificación. Las consultas sobre condiciones desconocidas se entregan al equipo; no reciben datos comerciales inventados.
8. `ASESOR` pausa el asistente. `SALIR` cancela borradores pendientes y elimina el seguimiento programado. No se envía una nueva secuencia sin volver a solicitar permiso.

La calificación se puede probar íntegramente en el simulador. El adaptador real no puede validarse contra Meta hasta conectar una cuenta y publicar un webhook HTTPS.

## Pendiente de confirmar

- Horarios y condiciones concretas de entrega. Los radios de los anuncios no definen entrega.
- Catálogo, precios, mínimos, disponibilidad, pagos y condiciones de entrega.
- Condiciones de muestras y aprobación del dueño o administrador. El usuario propone «dar unas 5» para presentar un piloto; falta aclarar si son unidades por prospecto o cantidad de prospectos, y su costo. No es una oferta comercial aprobada.
- Criterios definitivos de cierre y recurrencia. El usuario quiere identificar compradores con cantidades diarias, semanales o mensuales. Se propuso separar primera venta de cliente recurrente, sin automatizar una definición todavía no acordada.
- App de Meta y acceso de desarrollador. La captura muestra acceso total al portafolio comercial; falta comprobar la aplicación y la elegibilidad de coexistencia con el número actual antes de activar Cloud API.
- Frecuencia, horarios y límites de los seguimientos; política de tratamiento de datos y retención que aplicará al negocio.
- Responsable y plazo de atención humana. La aplicación no promete tiempos de respuesta.

## Métricas de esta versión

- Oportunidades abiertas: todas salvo ganadas y perdidas.
- Valor en oportunidades: suma de valores estimados manuales de las abiertas. No es ingreso ni tiene moneda inferida.
- Tasa de cierre: ganadas / (ganadas + perdidas). Muestra el número de cierres que la respalda; sin cierres muestra un guion.
- Seguimientos vencidos: abiertas con una fecha anterior al momento actual.

Antes de afirmar una mejora de resultados deben medirse los contactos por campaña y período, tiempo de primera atención, solicitudes y entregas de muestras, primeros pedidos y sus definiciones de cierre. La versión actual no importa estadísticas ni atribución de anuncios y no sustituye esa medición.

## Trazabilidad del Kanban y atención manual

Cada tarjeta puede cambiarse de etapa mediante un selector accesible o arrastrándola a otra columna. El servidor conserva cada cambio en el historial y mantiene el responsable, datos de contacto y seguimientos existentes. Las etiquetas siguen siendo configurables.

Desde el detalle del lead se puede abrir WhatsApp con un teléfono que incluya indicativo internacional. Esto no sincroniza conversaciones ni envía mensajes automáticamente. El asesor registra la nota, el resultado y la próxima fecha de seguimiento en el CRM.

## Medición propuesta para el piloto de muestras

Separar una primera venta de una relación recurrente evita contar una solicitud de muestra como cliente cerrado. Propuesta para acordar: primera venta cuando exista un primer pedido real; cliente recurrente cuando haya compras repetidas o un acuerdo de suministro respaldado por pedidos. La frecuencia y la cantidad deben registrarse según cada cliente, sin imponer el mismo mínimo diario, semanal o mensual a todos.

El usuario confirmó que el tamaño del piloto de muestras sigue por definir. Su tamaño y sus condiciones no están aprobados. Comparar solicitudes, muestras efectivamente entregadas, primeros pedidos y repetición de compras antes de afirmar que el piloto mejora el cierre. No se garantiza un aumento de ventas.
