# Conectar Meta: WhatsApp primero

## Estado actual

El código y las pruebas locales del adaptador están preparados. **No se ha verificado ninguna cuenta ni enviado un mensaje real.** Instagram y Facebook siguen pendientes; el endpoint actual solo procesa eventos de texto de WhatsApp. Los estados de entrega, adjuntos y medios no se procesan todavía. `sent` significa que la API aceptó la solicitud, no que el destinatario la haya recibido o leído.

La integración usa la API oficial y un número de WhatsApp Cloud API. Tener la aplicación WhatsApp Business o un repositorio en GitHub no demuestra acceso a esa API. La incorporación o coexistencia del número actual debe comprobarse en la configuración y documentación vigente de Meta; no desconectes ni migres el número sin revisar sus condiciones.

## Requisitos externos

- Acceso de administrador al negocio y a la aplicación de Meta correspondiente.
- Cuenta de WhatsApp Business y número habilitado para Cloud API.
- Token con permisos de envío para esa cuenta, según la configuración vigente de Meta.
- URL HTTPS accesible para verificar y recibir webhooks.
- Configuración comercial aprobada: ubicación, cobertura, muestras y traspaso a una persona.

Referencias oficiales para revisar al conectar:

- https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

La documentación externa no se pudo consultar en la sesión inicial porque el proxy no permitía `developers.facebook.com`. Las pruebas usan fixtures y transporte simulado; se debe contrastar la versión y los permisos actuales al hacer la conexión real.

## Variables del proceso

Nunca pegues credenciales en conversaciones, código, capturas o archivos versionados. Configúralas de forma segura en el despliegue que recibirá los webhooks.

| Variable                   | Uso                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `META_APP_SECRET`          | Secreto real de la app, necesario **localmente** para verificar HMAC SHA-256 de cada cuerpo recibido.                            |
| `META_VERIFY_TOKEN`        | Valor privado elegido por el administrador para el desafío inicial del webhook. Debe coincidir con el valor configurado en Meta. |
| `META_ACCESS_TOKEN`        | Credencial para solicitudes HTTPS salientes a `graph.facebook.com`.                                                              |
| `WHATSAPP_PHONE_NUMBER_ID` | Identificador del número autorizado. Eventos de otro número se rechazan.                                                         |
| `META_GRAPH_VERSION`       | Versión vigente de Graph elegida y verificada en la app, con formato `vNN.N`. No hay una versión inventada por defecto.          |
| `META_SEND_ENABLED`        | Por defecto desactivado. Solo el valor `true` habilita el trabajador de envíos y requiere las cinco variables anteriores.        |

Un secreto sustituido por un proxy únicamente en solicitudes salientes puede servir para el token de Graph en esa ruta, pero **no** sustituye al secreto real usado por HMAC dentro del proceso. No configures un placeholder del proxy como `META_APP_SECRET`. Si la plataforma no permite inyectar secretos reales en el proceso, la verificación del webhook debe ejecutarse en un despliegue que sí lo permita; no se debe desactivar la firma.

## Rutas y activación

- GET y POST `/api/integrations/meta/webhook`: desafío de verificación y recepción de eventos firmados.
- GET `/api/integrations/meta/status`: estado local y presencia de requisitos, nunca sus valores. No demuestra conectividad ni permisos válidos en Meta.
- GET `/api/leads/:id/messages`: conversación y estado de calificación, para el CRM privado.
- POST `/api/bot/simulate`: recorrido aislado, sin guardar leads ni enviar mensajes.

1. Mantener `META_SEND_ENABLED` desactivado.
2. Preparar un despliegue con almacenamiento persistente y gestión segura de secretos. Mantener el CRM privado hasta añadir autenticación. Si se usa un proxy HTTPS, publicar **solamente** la ruta del webhook; el resto de `/api` y la interfaz deben seguir privados.
3. Configurar las variables reales, reiniciar y verificar localmente el estado. El frontend debe acceder por el mismo origen del servidor o el proxy local de Vite; no se configura CORS abierto.
4. Registrar en Meta la URL HTTPS del webhook y el token de verificación. Suscribir la cuenta al campo de mensajes de WhatsApp según la documentación vigente.
5. Enviar desde un número de prueba autorizado un mensaje al número de la cuenta. Comprobar oportunidad, conversación, firma válida y deduplicación. Los borradores aún no salen.
6. Con aprobación del responsable de la cuenta, habilitar envíos y reiniciar. Hacer una conversación completa desde el número de prueba. Verificar recepción real, pausa ante ASESOR, salida y persistencia antes de atender tráfico comercial.

## Alcance y recuperación

- Se responde solo a mensajes entrantes de texto; no se inicia contacto en frío ni se mandan seguimientos proactivos.
- Un mensaje sin timestamp válido, con fecha futura o de hace más de 24 horas no habilita un envío automático.
- Los borradores anteriores se cancelan cuando llega un mensaje nuevo. En pausa o salida no se generan nuevas respuestas de calificación.
- El trabajador revisa la cola cada tres segundos, si está habilitado. Solo intenta borradores de menos de cinco minutos para no despachar una conversación vieja al activar la integración.
- Si Graph rechaza el envío, queda `failed`. Si no se puede saber si llegó a aceptarlo, queda `unknown`. No se reintenta automáticamente para evitar duplicados. Hay que revisar la conversación y Meta antes de cualquier reenvío.
- Un proceso interrumpido durante el envío puede dejar `sending`. También requiere revisión manual. Esta versión no tiene consola de recuperación de envíos.
- El recordatorio de atención al equipo es interno. No promete que alguien vaya a responder en un plazo.
- Faltan autenticación, roles, despliegue, manejo completo de medios/estados y validación de Meta para usar el sistema comercialmente.
