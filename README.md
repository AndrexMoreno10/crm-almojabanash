# Almo · CRM para almojábanas

Primera versión de un CRM para acompañar los contactos que llegan desde campañas de Meta, especialmente compradores al por mayor, hoteles, eventos y revendedores. El objetivo es que cada conversación tenga contexto, responsable y un siguiente paso hacia una muestra o un primer pedido.

## Lo que funciona

- Tablero Kanban con cinco etapas configurables, arrastrar tarjetas y selector de etapa. Cada movimiento queda en el historial.
- Apertura de WhatsApp para atención manual de contactos con indicativo internacional; sin sincronización automática.
- Registro de contacto, canal, campaña, responsable y valor estimado opcional, sin moneda asumida.
- Notas e historial, agenda de seguimiento, búsqueda y exportación CSV.
- Persistencia local con SQLite; las pruebas usan bases temporales separadas.
- Simulador de un asistente guiado: permiso de seguimiento, tipo de comprador, cantidad, ciudad, nombre e interés en una muestra.
- Pausa ante preguntas que requieren información comercial o un asesor. `SALIR` detiene el seguimiento automático.
- Adaptador de WhatsApp Cloud API: verificación de webhook, firma HMAC, deduplicación, contacto y conversación persistentes, respuestas en borrador y cola de envío opcional.

**No está conectado a una cuenta real de Meta.** Instagram, Facebook, comentarios y atribución automática de campañas quedan pendientes. La sede, el teléfono y los municipios atendidos están confirmados por el usuario. No hay clientes, precios, catálogo ni condiciones de muestras inventados. Los contactos de las pruebas son ficticios y no quedan en la base de trabajo.

## Empezar

Requiere **Node.js 24** y npm. SQLite viene incluido en Node; no requiere un servicio externo.

```bash
cd /workspace/crm-almojabanash
npm ci --cache /workspace/.cache/npm --no-fund --no-audit
npm run dev
```

`npm run dev` inicia la interfaz en el puerto 5173 y la API en el 3001, ambos en loopback. El proxy de desarrollo usa el puerto 3001; no cambies `PORT` en este modo. Para comprobar el servidor internamente:

```bash
curl --fail http://127.0.0.1:3001/api/health
```

Para ejecutar la interfaz compilada y la API con un único proceso:

```bash
npm run build
npm start
```

La base se crea en `data/crm.sqlite`, directorio ignorado por Git. `CRM_DATABASE_PATH` permite otra ruta y `PORT` permite otro puerto en el modo de servidor único. Exporta las variables en el proceso; no hay carga automática de `.env`. No borres ni sobrescribas una base existente para repetir la instalación.

Cada tarea de Codex ya está aislada: usa este checkout existente y no crees worktrees salvo que el usuario lo pida.

## Validar

```bash
npm run check
npm run test:e2e
```

`check` compila TypeScript y Vite y ejecuta trece pruebas de API, persistencia, bot y adaptador Meta. `test:e2e` inicia su propio servidor y base temporal, usa Chromium y prueba registro, cambio de etapa, notas, recarga, conversación del bot y tamaño móvil. Usa `/usr/bin/chromium`; otra instalación puede indicarse con `CHROMIUM_PATH`. Las imágenes de comprobación se guardan fuera del repositorio, en `/tmp/almo-crm-desktop.png` y `/tmp/almo-crm-mobile.png`.

## Antes de atender clientes reales

Esta versión es **un entorno de desarrollo de un solo equipo, sin inicio de sesión ni roles**. La API y la interfaz deben permanecer privadas hasta implementar autenticación y control de acceso. No expongas todo el servidor para conectar Meta. Lee [la guía de Meta](docs/META.md) para publicar únicamente la ruta del webhook detrás de HTTPS y preparar las credenciales en un despliegue adecuado.

El asistente es un flujo determinista, no un modelo generativo. Permite probar la conversación sin pagar una API de IA y sin inventar respuestas sobre el negocio. Los seguimientos por fecha son internos; aún no se mandan mensajes proactivos ni plantillas de WhatsApp. Las muestras siempre necesitan confirmación humana y la venta se marca manualmente. No hay una mejora de conversión medida todavía.

Consulta [las decisiones y los pendientes del negocio](docs/PRODUCTO.md).
