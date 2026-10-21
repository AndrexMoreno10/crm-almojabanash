# Almo · CRM para almojábanas

Primera versión de un CRM para acompañar los contactos que llegan desde campañas de Meta, especialmente compradores al por mayor, hoteles, eventos y revendedores. El objetivo es que cada conversación tenga contexto, responsable y un siguiente paso hacia una muestra o un primer pedido.

## Lo que funciona

- Secciones independientes de **Resumen** y **Embudo de ventas** en el sidebar. El resumen reúne indicadores, seguimientos y oportunidades recientes; el embudo conserva el Kanban.
- Tablero Kanban con ocho etapas comerciales configurables: nuevo lead, atención, información enviada, interés confirmado, muestra, cierre del pedido, primera compra y recurrencia. Cada movimiento queda en el historial. Las oportunidades perdidas se consultan aparte y se pueden recuperar.
- Apertura de WhatsApp para atención manual de contactos con indicativo internacional; sin sincronización automática.
- Registro de contacto, canal, campaña, responsable y valor estimado opcional, sin moneda asumida.
- Notas e historial, agenda de seguimiento, búsqueda y exportación CSV.
- Persistencia local con SQLite; las pruebas usan bases temporales separadas.
- Simulador de un asistente guiado: permiso de seguimiento, tipo de comprador, cantidad, ciudad, nombre e interés en una muestra.
- Pausa ante preguntas que requieren información comercial o un asesor. `SALIR` detiene el seguimiento automático.
- Adaptador de WhatsApp Cloud API: verificación de webhook, firma HMAC, deduplicación, contacto y conversación persistentes, respuestas en borrador y cola de envío opcional.

**No está conectado a una cuenta real de Meta.** Instagram, Facebook, comentarios y atribución automática de campañas quedan pendientes. La sede, el teléfono y los municipios atendidos están confirmados por el usuario. No hay clientes, precios, catálogo ni condiciones de muestras inventados. Los contactos de las pruebas son ficticios y no quedan en la base de trabajo.

## Revisar en Windows

Requiere Git y **Node.js 24**. En PowerShell puedes obtener la ruta real del Escritorio, incluso si está en OneDrive:

```powershell
Set-Location ([Environment]::GetFolderPath('Desktop'))
git clone https://github.com/AndrexMoreno10/crm-almojabanash.git
if ($LASTEXITCODE -ne 0) { throw 'No se pudo clonar. Comprueba Git, el acceso a GitHub y si la carpeta ya existe.' }
Set-Location .\crm-almojabanash
.\iniciar-windows.cmd
```

El iniciador instala las dependencias con el lockfile, compila y abre el navegador en Windows. También puedes abrir `iniciar-windows.cmd` con doble clic dentro de la carpeta del proyecto. Mantén su ventana abierta; Ctrl+C detiene el servidor. No sobrescribe una base de datos existente.

El modo de revisión usa un puerto local libre, funciona sin claves y desactiva Meta aunque haya variables configuradas. No importa ni envía mensajes reales. Los leads introducidos se guardan en `data/crm.sqlite`. Para volver a abrirlo, ejecuta el iniciador otra vez.

En otro sistema, después de instalar y compilar, ejecuta `npm run review -- --no-open`. Abre la dirección que muestra en la terminal de tu propio equipo. El servidor de revisión y el recorrido de navegador se comprobaron en Linux; la ejecución del archivo `.cmd` y la apertura del navegador en Windows requieren comprobarse en el computador del usuario.

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

`check` compila TypeScript y Vite y ejecuta quince pruebas de API, persistencia, bot y adaptador Meta. `test:e2e` inicia su propio servidor y base temporal, usa Chromium y prueba registro, las ocho etapas, pérdida y recuperación, métricas de primera compra y recurrencia, notas, recarga, conversación del bot y tamaño móvil. Usa `/usr/bin/chromium`; otra instalación puede indicarse con `CHROMIUM_PATH`. Las imágenes de comprobación se guardan fuera del repositorio, en `/tmp/almo-crm-desktop.png` y `/tmp/almo-crm-mobile.png`.

## Antes de atender clientes reales

Esta versión es **un entorno de desarrollo de un solo equipo, sin inicio de sesión ni roles**. La API y la interfaz deben permanecer privadas hasta implementar autenticación y control de acceso. No expongas todo el servidor para conectar Meta. Lee [la guía de Meta](docs/META.md) para publicar únicamente la ruta del webhook detrás de HTTPS y preparar las credenciales en un despliegue adecuado.

El asistente es un flujo determinista, no un modelo generativo. Permite probar la conversación sin pagar una API de IA y sin inventar respuestas sobre el negocio. Los seguimientos por fecha son internos; aún no se mandan mensajes proactivos ni plantillas de WhatsApp. Las muestras siempre necesitan confirmación humana y la venta se marca manualmente. No hay una mejora de conversión medida todavía.

Consulta [las decisiones y los pendientes del negocio](docs/PRODUCTO.md).

## Actualizar una copia existente

Detén el servidor con Ctrl+C y ejecuta desde la carpeta del CRM:

```powershell
git pull --ff-only
npm.cmd run build
npm.cmd run review
```

La ampliación del embudo se aplica al arrancar. Conserva los identificadores de las etapas anteriores, los leads, las notas, los seguimientos y las etiquetas personalizadas. Añade las etapas nuevas y actualiza únicamente los nombres predeterminados antiguos. La actualización se registra una sola vez; no borres `data/crm.sqlite` para actualizar.

Las ocho columnas se recorren horizontalmente. El botón **Perdidas** conserva los cierres negativos fuera del recorrido principal. Los cambios de etapa son manuales; ninguna muestra se aprueba ni ningún pedido se entrega automáticamente por mover una tarjeta.
