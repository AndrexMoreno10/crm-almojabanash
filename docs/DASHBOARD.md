# Qué prioriza el Resumen

El panel separa trabajo pendiente de resultados comerciales. Los contadores usan datos guardados y los accesos de atención abren la lista filtrada correspondiente.

| Indicador | Criterio y acción |
| --- | --- |
| Sin revisar en CRM | Todavía no se ha registrado la apertura de la ficha, o hay un mensaje entrante posterior a la última revisión. Abre los leads pendientes de revisar. No representa el estado de lectura de WhatsApp. |
| Primera atención pendiente | Lead en Nuevo lead. Abrir su ficha no lo quita de este grupo; el equipo registra la atención al cambiar su etapa. |
| Sin responsable | Oportunidades anteriores a primera compra sin una persona asignada. Asigna quién debe atenderlas. |
| Sin próximo contacto | Oportunidades anteriores a primera compra sin fecha de seguimiento. Define cuándo volver a contactar. |
| Seguimientos vencidos | Fecha del próximo contacto anterior al momento actual; excluye perdidas e incluye clientes que ya compraron. Abre la agenda. |
| Oportunidades abiertas | Etapas desde Nuevo lead hasta Pedido en cierre. |
| Tasa de cierre | Leads en Primera compra o Cliente recurrente / leads en esas dos etapas o perdidos. Es el porcentaje sobre cierres registrados, no la conversión de una campaña o período. |
| Primera compra | Leads actualmente clasificados en Primera compra realizada. |
| Clientes recurrentes | Leads actualmente clasificados en Cliente recurrente; no se duplican en la tasa de cierre. |

Los grupos de atención pueden compartir leads; no deben sumarse como si fueran personas distintas. La distribución por ocho etapas permite localizar oportunidades en muestra o cierre. Las condiciones y cantidades de muestras siguen sin aprobarse.

La revisión se guarda en `lead_reviews`, aparte de las etapas, notas y fechas comerciales. Los contactos anteriores a esta función aparecen pendientes de revisar porque no existe una revisión registrada; no se infiere su atención histórica. Un mensaje nuevo vuelve a marcar la ficha como pendiente mediante su identificador, incluso si comparte timestamp con otro. Un borrador no cuenta como mensaje recibido ni como respuesta enviada.

## Métricas siguientes, cuando existan los datos

- Tiempo hasta la primera respuesta y mensajes pendientes de respuesta reales, después de conectar y verificar Meta.
- Conversión por campaña y por fecha de entrada, con atribución y cohortes reales.
- Muestras aprobadas, entregadas y convertidas en primera compra, después de acordar y registrar esos hitos.
- Volumen, frecuencia y valor de compras recurrentes cuando exista registro de pedidos.

No se muestran ventas, ingresos, retorno publicitario ni tiempos de respuesta estimados a partir de datos que el CRM aún no captura.
