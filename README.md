# Almo · CRM para almojábanas

Primera versión de un CRM para acompañar los contactos que llegan desde campañas de Meta, especialmente compradores al por mayor, hoteles, eventos y revendedores. El objetivo es que cada conversación tenga contexto, responsable y un siguiente paso hacia una muestra o un primer pedido.

## Lo que funciona

- Secciones independientes de **Resumen** y **Embudo de ventas** en el sidebar. El resumen muestra una única lista para atender, hacer seguimiento y cerrar; el embudo conserva el Kanban.
- Interfaz en azul, naranja y blanco, tipografía Manrope alojada en el proyecto, navegación móvil con etiquetas y fichas divididas en información, actividad y conversación.
- Tablero Kanban con ocho etapas comerciales configurables: nuevo lead, atención, información enviada, interés confirmado, muestra, cierre del pedido, primera compra y recurrencia. Cada movimiento queda en el historial. Las oportunidades perdidas se consultan aparte y se pueden recuperar.
- Embudo con encabezado compacto, tarjetas más anchas y resumidas y desplazamiento independiente en cada etapa. Los campos vacíos y valores en cero se omiten en la tarjeta; la ficha conserva toda la información.
- Apertura de WhatsApp para atención manual de contactos con indicativo internacional; sin sincronización automática.
- Registro de contacto, canal, campaña, responsable y valor estimado opcional, sin moneda asumida.
- Notas e historial, agenda de seguimiento, búsqueda y exportación CSV.
- Inicio con tres vistas: Por atender, Seguimientos y Por cerrar, con acceso al detalle y a la lista completa. Se conserva el acceso a fichas sin revisar en CRM; revisar no significa responder o avanzar de etapa.
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

El iniciador prepara las dependencias cuando sea necesario y abre el navegador en Windows, **sin compilar cada vez**. También puedes abrir `iniciar-windows.cmd` con doble clic dentro de la carpeta del proyecto. Mantén su ventana abierta; Ctrl+C detiene los servicios.

Vite actualiza la interfaz al guardar y `tsx watch` reinicia la API cuando cambia su código. Además, el iniciador consulta GitHub cada 20 segundos: aplica únicamente avances directos de `main` cuando la copia está limpia. Se pausa ante cambios locales, otra rama, historiales divergentes o archivos que Git no puede conservar; nunca hace reset ni borra la base. Si cambian las dependencias, las prepara y reinicia sus servicios. Un cambio en el propio iniciador requiere volver a abrirlo.

El desarrollo desactiva los envíos de Meta aunque haya variables configuradas. Los contactos se conservan en `data/crm.sqlite`. Este flujo se verificó en Linux; el archivo `.cmd` y la apertura del navegador en Windows requieren comprobarse en el computador del usuario.

## Empezar

Requiere **Node.js 24** y npm. SQLite viene incluido en Node; no requiere un servicio externo.

```bash
cd /workspace/crm-almojabanash
npm run dev
```

`npm run dev` prepara dependencias e inicia la interfaz en el puerto 5173 y la API en el 3001, ambos en loopback, con actualización al guardar. Usa `npm run dev:sync` si también quieres recibir los cambios publicados en GitHub. El acceso a GitHub usa la configuración de Git del equipo; no guardes tokens en estos scripts. Si falla la conexión, el CRM conserva su copia local. No cambies `PORT` en este modo. Si los puertos están ocupados, cierra la sesión anterior; el iniciador no detiene procesos ajenos.

Para comprobar el servidor internamente:

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

`check` compila TypeScript y Vite y ejecuta veinticuatro pruebas de API, persistencia, revisión de fichas, identidad visual, bot, Meta y sincronización Git, incluyendo la conservación de archivos ignorados. `test:e2e` inicia su propio servidor y base temporal, usa Chromium y prueba registro, ocho etapas, pérdida y recuperación, indicadores, notas, filtros, exportación, recarga, insignias del canal junto a las iniciales, carga del logo, conversación del bot y tamaño móvil. También ejecuta axe sobre las vistas principales para detectar problemas WCAG A/AA. Usa `/usr/bin/chromium`; otra instalación puede indicarse con `CHROMIUM_PATH`. Las capturas se guardan fuera del repositorio, en `/tmp/almo-crm-desktop.png`, `/tmp/almo-crm-mobile.png`, `/tmp/almo-crm-overview.png` y `/tmp/almo-crm-overview-mobile.png`.

## Antes de atender clientes reales

Esta versión es **un entorno de desarrollo de un solo equipo, sin inicio de sesión ni roles**. La API y la interfaz deben permanecer privadas hasta implementar autenticación y control de acceso. No expongas todo el servidor para conectar Meta. Lee [la guía de Meta](docs/META.md) para publicar únicamente la ruta del webhook detrás de HTTPS y preparar las credenciales en un despliegue adecuado.

El asistente es un flujo determinista, no un modelo generativo. Permite probar la conversación sin pagar una API de IA y sin inventar respuestas sobre el negocio. Los seguimientos por fecha son internos; aún no se mandan mensajes proactivos ni plantillas de WhatsApp. Las muestras siempre necesitan confirmación humana y la venta se marca manualmente. No hay una mejora de conversión medida todavía.

Consulta [las decisiones y los pendientes del negocio](docs/PRODUCTO.md).

Consulta [los criterios del dashboard](docs/DASHBOARD.md) para distinguir revisión, primera atención, seguimiento y conversión.

La [auditoría del frontend](docs/FRONTEND-AUDIT.md) detalla los cambios visuales y de accesibilidad. GitHub Actions ejecuta compilación y pruebas en los pushes a main y pull requests. El despliegue queda pendiente de definir el proveedor y destino.

## Actualizar una copia existente

Detén el servidor con Ctrl+C y ejecuta desde la carpeta del CRM:

```powershell
git pull --ff-only
npm.cmd run dev:sync
```

Estos comandos se necesitan una vez para recibir el nuevo iniciador. Después puedes dejar `dev:sync` abierto mientras revisas los cambios publicados. Para trabajar sobre código local, `npm run dev` ofrece el mismo refresco sin consultar GitHub. `build` queda para validación y despliegue; `review` sigue disponible para revisar la versión compilada y requiere un build previo.

La ampliación del embudo se aplica al arrancar. Conserva los identificadores de las etapas anteriores, los leads, las notas, los seguimientos y las etiquetas personalizadas. Añade las etapas nuevas y actualiza únicamente los nombres predeterminados antiguos. La actualización se registra una sola vez; no borres `data/crm.sqlite` para actualizar.

Las ocho columnas se recorren horizontalmente. El botón **Perdidas** conserva los cierres negativos fuera del recorrido principal. Los cambios de etapa son manuales; ninguna muestra se aprueba ni ningún pedido se entrega automáticamente por mover una tarjeta.

Las tarjetas y la ficha del contacto muestran una insignia de WhatsApp, Instagram o Facebook junto a las iniciales, según el origen registrado. No requieren elegir el canal en la tarjeta. El adaptador de WhatsApp preparado registra ese origen al crear el lead desde un webhook; la conexión real con Meta sigue pendiente. Tener teléfono no asigna WhatsApp automáticamente. Puedes corregir datos de contactos manuales desde su ficha.

El sidebar muestra solo el logo del negocio, centrado y a mayor tamaño; el clic abre el Resumen. La cámara permite cambiarlo con un PNG, JPG o WebP de hasta 2 MB y 4096 × 4096 píxeles. Se conserva el archivo en SQLite y se utiliza en el sidebar y el icono de la pestaña. Persiste al recargar y reiniciar; no requiere recompilar ni subir el archivo a GitHub. El monograma sigue visible hasta cargar el archivo en ese CRM. Se eliminaron el nombre duplicado, la tarjeta de sede y la tarjeta grande de pendientes; Seguimientos conserva el indicador de vencidos.
