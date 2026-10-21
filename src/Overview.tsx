import {
  ArrowRight,
  CalendarClock,
  Clock3,
  LayoutGrid,
  LoaderCircle,
  Check,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  canFollowUp,
  isOpenStage,
  pipelineStages,
  type Lead,
  type Stage,
} from "../shared/types";
interface Props {
  leads: Lead[];
  labels: Record<Stage, string>;
  loading: boolean;
  unavailable: boolean;
  now: number;
  onOpen: (id: string) => void;
  onPipeline: () => void;
  onFollowups: () => void;
}
const date = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export default function Overview({
  leads,
  labels,
  loading,
  unavailable,
  now,
  onOpen,
  onPipeline,
  onFollowups,
}: Props) {
  const scheduled = leads
    .filter((lead) => canFollowUp(lead.stage) && lead.nextContactAt)
    .sort(
      (a, b) => Date.parse(a.nextContactAt!) - Date.parse(b.nextContactAt!),
    );
  const overdue = scheduled.filter(
    (lead) => Date.parse(lead.nextContactAt!) < now,
  );
  const total = leads.filter((lead) => lead.stage !== "lost").length;
  const estimated = leads
    .filter((lead) => isOpenStage(lead.stage))
    .reduce((sum, lead) => sum + lead.value, 0);
  if (unavailable)
    return (
      <div className="data-unavailable">
        <CalendarClock size={28} />
        <h2>No se pudo cargar la operación</h2>
        <p>Usa Actualizar para volver a consultar tus oportunidades.</p>
      </div>
    );
  return (
    <div className="overview-workspace">
      <div className={`priority-banner ${overdue.length ? "has-pending" : ""}`}>
        <span className="priority-icon">
          {overdue.length ? <Clock3 size={23} /> : <Check size={23} />}
        </span>
        <div>
          <strong>
            {loading
              ? "Consultando seguimientos…"
              : overdue.length
                ? `${overdue.length} seguimiento${overdue.length === 1 ? "" : "s"} vencido${overdue.length === 1 ? "" : "s"}`
                : "Sin seguimientos vencidos"}
          </strong>
          <p>
            {overdue.length
              ? "Retoma estos contactos y registra el siguiente paso."
              : "Programa el próximo contacto desde la ficha de cada oportunidad."}
          </p>
        </div>
        <button className="secondary" onClick={onFollowups}>
          Abrir agenda <ArrowRight size={16} />
        </button>
      </div>
      <div className="overview-grid">
        <section
          className="board-section overview-panel"
          aria-labelledby="overview-followups-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">PRIORIDAD DEL EQUIPO</span>
              <h2 id="overview-followups-title">
                Seguimientos por atender{" "}
                <span>{loading ? "—" : scheduled.length}</span>
              </h2>
            </div>
            <button className="text-button" onClick={onFollowups}>
              Ver todos <ArrowRight size={16} />
            </button>
          </div>
          {loading ? (
            <div className="large-empty">
              <LoaderCircle className="spin" />
              <p>Cargando agenda…</p>
            </div>
          ) : scheduled.length ? (
            <div className="overview-rows">
              {scheduled.slice(0, 5).map((lead) => (
                <button
                  className="overview-row"
                  key={lead.id}
                  onClick={() => onOpen(lead.id)}
                >
                  <span className="overview-row-icon">
                    {lead.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="overview-row-content">
                    <strong>{lead.name}</strong>
                    <small>
                      {lead.owner || "Sin responsable"} · {labels[lead.stage]}
                    </small>
                  </span>
                  <span
                    className={`overview-due ${Date.parse(lead.nextContactAt!) < now ? "late" : ""}`}
                  >
                    <span>
                      <Clock3 size={12} />
                      {Date.parse(lead.nextContactAt!) < now
                        ? "Vencido"
                        : "Programado"}
                    </span>
                    <time>{date(lead.nextContactAt!)}</time>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="large-empty">
              <span className="empty-icon">
                <CalendarClock size={28} />
              </span>
              <h3>Agenda tu primer seguimiento</h3>
              <p>Abre un contacto y define cuándo volverás a hablar con él.</p>
              <button className="secondary" onClick={onPipeline}>
                Ir al embudo <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="panel-footnote">
            <CalendarClock size={15} /> Se muestran primero los contactos
            vencidos.
          </div>
        </section>
        <section
          className="board-section funnel-panel"
          aria-labelledby="funnel-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                ESTADO DE LAS OPORTUNIDADES
              </span>
              <h2 id="funnel-title">Distribución del embudo</h2>
            </div>
            <LayoutGrid size={20} />
          </div>
          <div className="funnel-breakdown">
            {pipelineStages.map((stage, index) => {
              const count = leads.filter((lead) => lead.stage === stage).length;
              return (
                <div className={`funnel-row stage-${stage}`} key={stage}>
                  <span className="funnel-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="funnel-row-label">
                      <span>{labels[stage]}</span>
                      <strong>{loading ? "—" : count}</strong>
                    </div>
                    <div className="funnel-track">
                      <span
                        style={{
                          width: loading
                            ? "0%"
                            : `${(count / Math.max(total, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="funnel-link text-button" onClick={onPipeline}>
            Gestionar embudo <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <section
        className="board-section recent-panel"
        aria-labelledby="overview-leads-title"
      >
        <div className="section-heading">
          <div>
            <span className="section-kicker">ÚLTIMA ACTIVIDAD</span>
            <h2 id="overview-leads-title">Oportunidades actualizadas</h2>
          </div>
          <button className="text-button" onClick={onPipeline}>
            Ver embudo <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="large-empty">
            <LoaderCircle className="spin" />
            <p>Cargando contactos…</p>
          </div>
        ) : leads.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contacto</th>
                  <th>Etapa comercial</th>
                  <th>Responsable</th>
                  <th>Última actualización</th>
                </tr>
              </thead>
              <tbody>
                {leads.slice(0, 5).map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <button
                        className="contact-link"
                        onClick={() => onOpen(lead.id)}
                      >
                        <span className="table-avatar">
                          {lead.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{lead.name}</strong>
                          <small>{lead.source || "Sin canal"}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`stage-pill stage-${lead.stage}`}>
                        {labels[lead.stage]}
                      </span>
                    </td>
                    <td>{lead.owner || "Sin asignar"}</td>
                    <td>{date(lead.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="recent-empty">
            <span className="empty-icon">
              <Users size={27} />
            </span>
            <div>
              <h3>Tu lista de contactos empieza aquí</h3>
              <p>Usa Nueva oportunidad para añadir el primer lead.</p>
            </div>
          </div>
        )}
        <div className="estimated-value">
          <TrendingUp size={16} />
          <span>Valor estimado de oportunidades abiertas</span>
          <strong>
            {loading
              ? "—"
              : new Intl.NumberFormat("es-CO", {
                  maximumFractionDigits: 0,
                }).format(estimated)}
          </strong>
        </div>
      </section>
    </div>
  );
}
