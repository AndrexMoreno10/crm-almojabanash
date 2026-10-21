# Revisión del frontend

Fecha: 21 de octubre de 2026. Alcance: navegación, resumen, Kanban de ocho etapas, contactos, agenda, ficha y simulador. Auditoría independiente de código y comprobaciones en Chromium sobre datos temporales.

## Problemas y cambios

| Problema observado                               | Cambio realizado                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Paleta verde y beige ajena a la marca solicitada | Azul `#0955ad`, naranja `#f57a24`, blanco y superficies claras; azul para acciones principales, naranja para acentos con texto oscuro.          |
| Texto pequeño, poco contraste y jerarquía débil  | Manrope local, tamaños mayores, títulos operativos y estados de carga o error sin presentar ceros como datos reales.                            |
| Resumen sin una prioridad clara                  | Indicadores separados de agenda, seguimientos vencidos, distribución real por etapa y contactos recientes.                                      |
| Ocho columnas difíciles de descubrir             | Desplazamiento visible, botones anterior/siguiente, numeración y criterios de cada etapa. Se conserva el selector como alternativa al arrastre. |
| Ficha sobrecargada                               | Panel lateral con pestañas Información, Actividad y Conversación; acceso manual a WhatsApp e historial conservados.                             |
| Navegación móvil mediante iconos sin etiquetas   | Menú desplegable con nombres completos, control del foco y cierre por Escape.                                                                   |
| Riesgo de perder el foco al mover o cerrar       | Retorno al selector del contacto tras mover y al menú móvil cuando el botón original ya no está disponible.                                     |
| Simulador editable durante un envío pendiente    | Controles bloqueados durante la petición y desplazamiento al último mensaje.                                                                    |
| Exportación no ajustada a la vista de perdidas   | El CSV respeta el conjunto visible, además de sus filtros.                                                                                      |

Los tonos son una interpretación de los tres colores indicados por el usuario; no se han recibido códigos oficiales ni logotipo. El monograma tipográfico sirve como identidad provisional. No se añaden cifras comerciales, clientes ni condiciones inventadas para rellenar la interfaz.

### Ajuste de densidad del embudo

Se retiraron del encabezado visible la marca repetida, el segundo título y las explicaciones extensas. El tablero ocupa el espacio disponible en la ventana, con desplazamiento vertical independiente en cada etapa. En ventanas muy bajas se permite desplazar la página para mantener accesibles los controles.

Las columnas pasan de 248 a 300 píxeles mínimos en escritorio. Las tarjetas muestran nombre (hasta dos líneas), canal y teléfono disponibles, seguimiento programado y responsable asignado; el valor estimado solo aparece si es mayor que cero. El selector de etapa se conserva en una fila compacta y el clic abre la ficha completa. Se eliminan los textos de ausencia de campaña o responsable. La información sigue almacenada aunque no aparezca en el resumen.

## Validación

- `npm run check`: TypeScript, compilación de Vite y veintidós pruebas de negocio, revisión de fichas, persistencia y sincronización Git.
- `npm run test:e2e`: recorrido completo con SQLite temporal, ocho etapas, notas, recarga, indicadores, filtros, CSV, simulador y estados de error; revisión automática con axe de vistas principales, ficha y navegación móvil.
- Escritorio de 1440 y 1280 píxeles y móvil de 390 píxeles; comprobación de desbordamiento de página y capturas fuera del repositorio.
- Diez leads en una etapa: varias tarjetas completas visibles, nombres largos acotados, desplazamiento dentro de la columna sin alargar la página y apertura del detalle desde una tarjeta al final de la lista.
- Prueba real de Vite HMR en un navegador abierto, sin build, y reinicio de `tsx watch` al cambiar un archivo de servidor.

Las comprobaciones automáticas ayudan a detectar errores; no equivalen a una certificación de accesibilidad. La apertura del iniciador y el navegador de Windows debe verificarse en el equipo del usuario. La conexión real con Meta y la autenticación siguen fuera de este cambio.

## Desarrollo y publicación

`npm run dev` actualiza al guardar. `npm run dev:sync` consulta GitHub cada veinte segundos y solo avanza una copia limpia de main; conserva modificaciones, commits y archivos ignorados ante colisiones. Prepara dependencias únicamente cuando cambia su huella. Si cambia el código del propio iniciador, debe reiniciarse su ventana.

El workflow de GitHub valida compilación y pruebas en cada push a main o pull request. No publica un servidor: el proveedor y el destino de despliegue aún no se han definido.
