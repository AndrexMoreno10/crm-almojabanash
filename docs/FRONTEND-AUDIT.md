# Revisión del frontend

Fecha: 21 de octubre de 2026. Alcance: navegación, resumen, Kanban de ocho etapas, contactos, agenda, ficha y simulador. Auditoría independiente de código y comprobaciones en Chromium sobre datos temporales.

## Problemas y cambios

| Problema observado                               | Cambio realizado                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Paleta verde y beige ajena a la marca solicitada | Azul `#0955ad`, naranja `#f57a24`, blanco y superficies claras; azul para acciones principales, naranja para acentos con texto oscuro.          |
| Texto pequeño, poco contraste y jerarquía débil  | Manrope local, tamaños mayores, títulos operativos y estados de carga o error sin presentar ceros como datos reales.                            |
| Resumen sin una prioridad clara                  | Indicadores separados de agenda, seguimientos vencidos, distribución real por etapa y contactos recientes.                                      |
| Ocho columnas difíciles de descubrir             | Desplazamiento visible, botones anterior/siguiente, numeración y criterios de cada etapa. La ficha conserva el cambio de etapa como alternativa accesible al arrastre. |
| Ficha sobrecargada                               | Panel lateral con pestañas Información, Actividad y Conversación; acceso manual a WhatsApp e historial conservados.                             |
| Navegación móvil mediante iconos sin etiquetas   | Menú desplegable con nombres completos, control del foco y cierre por Escape.                                                                   |
| Riesgo de perder el foco al mover o cerrar       | Retorno a la tarjeta del contacto tras mover y al menú móvil cuando el botón original ya no está disponible.                                     |
| Simulador editable durante un envío pendiente    | Controles bloqueados durante la petición y desplazamiento al último mensaje.                                                                    |
| Exportación no ajustada a la vista de perdidas   | El CSV respeta el conjunto visible, además de sus filtros.                                                                                      |

Los tonos son una interpretación de los tres colores indicados por el usuario; no se han recibido códigos oficiales. El usuario compartió el logo en el chat, pero el archivo original no está disponible en el checkout. El monograma tipográfico sirve como identidad provisional hasta cargar ese archivo desde el sidebar. No se añaden cifras comerciales, clientes ni condiciones inventadas para rellenar la interfaz.

### Ajuste de densidad del embudo

Se retiraron del encabezado visible la marca repetida, el segundo título y las explicaciones extensas. El tablero ocupa el espacio disponible en la ventana, con desplazamiento vertical independiente en cada etapa. En ventanas muy bajas se permite desplazar la página para mantener accesibles los controles.

Las columnas pasan de 248 a 300 píxeles mínimos en escritorio. Las tarjetas muestran nombre (hasta dos líneas), canal y teléfono disponibles, seguimiento programado y responsable asignado; el valor estimado solo aparece si es mayor que cero. Se retiró el selector de etapa de la tarjeta porque la columna ya muestra ese estado. El clic abre la ficha, donde se mantiene el selector como alternativa al arrastre. Se eliminan los textos de ausencia de campaña o responsable. La información sigue almacenada aunque no aparezca en el resumen.

## Validación

- `npm run check`: TypeScript, compilación de Vite y veinticuatro pruebas de negocio, revisión de fichas, identidad visual, persistencia y sincronización Git.
- `npm run test:e2e`: recorrido completo con SQLite temporal, ocho etapas, notas, recarga, indicadores, filtros, CSV, simulador y estados de error; revisión automática con axe de vistas principales, ficha y navegación móvil.
- Escritorio de 1440 y 1280 píxeles y móvil de 390 píxeles; comprobación de desbordamiento de página y capturas fuera del repositorio.
- Diez leads en una etapa: varias tarjetas completas visibles, nombres largos acotados, desplazamiento dentro de la columna sin alargar la página y apertura del detalle desde una tarjeta al final de la lista.
- Prueba real de Vite HMR en un navegador abierto, sin build, y reinicio de `tsx watch` al cambiar un archivo de servidor.

Las comprobaciones automáticas ayudan a detectar errores; no equivalen a una certificación de accesibilidad. La apertura del iniciador y el navegador de Windows debe verificarse en el equipo del usuario. La conexión real con Meta y la autenticación siguen fuera de este cambio.

## Desarrollo y publicación

`npm run dev` actualiza al guardar. `npm run dev:sync` consulta GitHub cada veinte segundos y solo avanza una copia limpia de main; conserva modificaciones, commits y archivos ignorados ante colisiones. Prepara dependencias únicamente cuando cambia su huella. Si cambia el código del propio iniciador, debe reiniciarse su ventana.

El workflow de GitHub valida compilación y pruebas en cada push a main o pull request. No publica un servidor: el proveedor y el destino de despliegue aún no se han definido.

## Inicio simplificado para la gestión comercial

El Resumen se sustituyó por una sola lista con tres pestañas: Por atender, Seguimientos y Por cerrar. Los leads vencidos aparecen primero en seguimientos y las conversaciones sin próxima fecha también se incluyen. Cada fila abre su ficha y permite identificar el siguiente paso; la lista completa conserva el mismo filtro. Se retiraron las tarjetas grandes, el gráfico, el valor estimado, los contactos recientes y la tarjeta lateral de agenda del inicio. Los resultados de primera compra y recurrencia quedan en una línea breve. Se conserva Sin revisar en CRM como acceso secundario. No se incorpora inventario. Los criterios completos están en DASHBOARD.md.

## Logos y contactos existentes

Los iconos sociales se muestran como una insignia pequeña en la esquina de las iniciales, tanto en la tarjeta como en la ficha del contacto. El texto del canal se conserva junto al teléfono sin repetir el icono. Se retiró el selector de canal de la tarjeta: la insignia utiliza el origen registrado y el webhook preparado de WhatsApp lo asigna automáticamente al crear el lead. No se infiere el origen a partir del teléfono ni se modifica su etapa. Las conexiones reales con Meta, Instagram y Facebook siguen pendientes.

La cámara del sidebar permite cargar el logo original desde el equipo del usuario. El navegador comprueba que pueda leer la imagen y sus dimensiones; la API limita tamaño y tipos raster, valida su firma y conserva los bytes en SQLite. La imagen actualiza sidebar y favicon sin build. La prueba de navegador comprueba las insignias de los canales, carga una imagen de prueba y comprueba ambos resultados tras recargar. Las pruebas de API comprueban persistencia al reiniciar, conservación de leads y notas y rechazo de cargas inválidas.

El sidebar usa un logo centrado de 128 × 128 píxeles con ajuste proporcional. El nombre «Almojábanas Huilenses MJ» aparece centrado debajo del logo en dos líneas, seguido por «Las Originales» como lema. Se retiraron la tarjeta de sede y el bloque grande de pendientes. El indicador de seguimientos vencidos continúa en el acceso de navegación. La configuración y la ubicación quedan en un pie breve. El logo abre Resumen y la cámara mantiene la carga independiente; la imagen ya guardada se conserva.

Las tarjetas marcan con un punto azul los leads sin revisar en CRM y con un doble chulo gris los revisados. Abrir la ficha actualiza el indicador mediante la revisión persistente existente; un mensaje entrante nuevo vuelve a dejar pendiente la revisión. Estos indicadores no representan confirmaciones de lectura de WhatsApp.
