# Conectar Meta: WhatsApp primero

## Estado actual

El código y las pruebas locales del adaptador están preparados. **No se ha verificado ninguna cuenta ni enviado un mensaje real.** Instagram y Facebook siguen pendientes; el endpoint actual solo procesa eventos de texto de WhatsApp. Los estados de entrega, adjuntos y medios no se procesan todavía. `sent` significa que la API aceptó la solicitud, no que el destinatario la haya recibido o leído.

La integración usa la API oficial y un número de WhatsApp Cloud API. Tener la aplicación WhatsApp Business o un repositorio en GitHub no demuestra acceso a esa API. Meta documenta una modalidad de **Coexistencia** para incorporar determinados números de la aplicación WhatsApp Business y seguir usando la aplicación. La elegibilidad del número y de la cuenta debe comprobarse durante el registro; no desconectes ni migres el número comercial por fuera de ese recorrido.

El 21 de octubre de 2026 se consultó la documentación oficial vigente de Coexistencia. Si el negocio acepta compartir su información, Meta documenta sincronización de contactos y de los chats de los últimos 180 días. La solicitud de sincronización debe iniciarse dentro de las 24 horas posteriores al registro y solo puede iniciarse una vez sin cancelar y repetir el registro. El código actual todavía **no procesa** los webhooks `history`, `smb_message_echoes` ni la sincronización de contactos; por eso conectar ahora solo pintaría mensajes de texto nuevos. Hay que implementar y probar esos eventos antes de incorporar el número real si se desea importar el historial.

## Requisitos externos

- Acceso de administrador al negocio y a la aplicación de Meta correspondiente.
- Cuenta de WhatsApp Business y número habilitado para Cloud API.
- Token con permisos de envío para esa cuenta, según la configuración vigente de Meta.
- URL HTTPS accesible para verificar y recibir webhooks.
- Servidor Node activo y almacenamiento persistente. El SQLite local del proyecto no debe alojarse en el sistema de archivos temporal de una función serverless.
- Configuración comercial aprobada: ubicación, cobertura, muestras y traspaso a una persona.

Referencias oficiales para revisar al conectar:

- https://developers.facebook.com/docs/whatsapp/cloud-api/overview
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/

Las pruebas usan fixtures y transporte simulado; la versión, los permisos y la elegibilidad deben contrastarse en la app real al hacer la conexión.

## Datos que hay que obtener en Meta

1. Crear una app en [Meta for Developers → Mis apps](https://developers.facebook.com/apps/) y asociarla al portafolio comercial de Almojábanas Huilenses MJ.
2. Agregar el caso de uso o producto de WhatsApp y completar primero una prueba con el número de prueba de Meta.
3. Anotar, sin compartirlos por chat, el ID de la app, el ID de la cuenta de WhatsApp Business y el ID del número. El CRM usa directamente `WHATSAPP_PHONE_NUMBER_ID`.
4. Elegir un token de verificación privado para el webhook y guardar el secreto de la app en el servidor.
5. Crear una credencial duradera con los permisos que Meta muestre para administrar y enviar mensajes de esa cuenta; el token temporal de Primeros pasos es únicamente para la prueba inicial.
6. Revisar en el flujo oficial si el número actual ofrece Coexistencia. Si la ofrece, confirmar con el dueño el uso compartido de contactos e historial y mantener abierta la aplicación durante la sincronización.
7. Configurar y suscribir la URL HTTPS del webhook al campo `messages`. Para Coexistencia también harán falta los eventos de historial y ecos que se implementen.

No publiques aquí el secreto ni los tokens. Las capturas pueden mostrar los nombres de los campos y los identificadores no secretos, ocultando cualquier valor sensible.

## Alojamiento

El proyecto actual usa un proceso Express de larga duración y un archivo SQLite. Un despliegue convencional de Vercel no ofrece esa combinación con persistencia estable. Para la prueba real se necesita un servicio Node con disco persistente o migrar la base a un servicio persistente. Además, la interfaz y las demás API siguen sin autenticación; no deben quedar públicas solo para exponer el webhook.

La opción de menor cambio es desplegar el servidor en un servicio que admita un proceso Node y un volumen persistente, proteger la aplicación y publicar el webhook por HTTPS. La alternativa más escalable es migrar SQLite a una base gestionada antes de publicar. La decisión de alojamiento debe tomarse antes de registrar la URL definitiva en Meta.

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

## Empezar con la aplicación WhatsApp Business

El CRM puede utilizarse sin claves para registrar contactos, actualizar el Kanban, tomar notas y programar seguimientos. El enlace del detalle abre WhatsApp para responder manualmente; los mensajes de la aplicación no se importan ni se automatizan.

WhatsApp Flows no es WhatsApp Cloud API: Flows sirve para experiencias estructuradas dentro del chat y no es requisito del bot de texto. Para recibir y responder automáticamente con la integración oficial sí hace falta Cloud API. Antes de tocar el número comercial, comprobar la elegibilidad y las condiciones vigentes de coexistencia con WhatsApp Business; no asumir que hay que desconectarlo.

Para localizar una app existente, usar **Configuración del negocio → Cuentas → Apps** y [Meta for Developers → Mis apps](https://developers.facebook.com/apps/). El acceso total al portafolio comercial no garantiza un rol en una app. En la app, Configuración → Básica suele contener el secreto; WhatsApp → Configuración de API o Primeros pasos muestra los identificadores y el token de prueba. Los nombres dependen del panel vigente. No guardar claves en archivos `.txt` ni compartir capturas de sus valores.
