import {
  ArrowRight,
  CalendarClock,
  Clock3,
  LayoutGrid,
  LoaderCircle,
  Users,
} from "lucide-react";
import type { Lead, Stage } from "../shared/types";

interface Props {
  leads: Lead[];
  labels: Record<Stage, string>;
  loading: boolean;
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
  now,
  onOpen,
  onPipeline,
  onFollowups,
}: Props) {
  const scheduled = leads
    .filter(
      (lead) =>
        lead.stage !== "won" && lead.stage !== "lost" && lead.nextContactAt,
    )
    .sort(
      (a, b) => Date.parse(a.nextContactAt!) - Date.parse(b.nextContactAt!),
    );
  return (
    <div className="overview-grid">
      <section
        className="board-section overview-panel"
        aria-labelledby="overview-followups-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="overview-followups-title">
              Seguimientos por atender <span>{scheduled.length}</span>
            </h2>
            <p>Primero los vencidos, después las próximas conversaciones.</p>
          </div>
          <button className="text-button" onClick={onFollowups}>
            Ver agenda <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="large-empty">
            <LoaderCircle className="spin" />
            <p>Cargando seguimientos…</p>
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
                  <CalendarClock size={19} />
                </span>
                <span className="overview-row-content">
                  <strong>{lead.name}</strong>
                  <small>
                    {lead.owner || "Sin responsable"} · {labels[lead.stage]}
                  </small>
                  <time
                    className={
                      Date.parse(lead.nextContactAt!) < now ? "late" : ""
                    }
                  >
                    <Clock3 size={11} />
                    {date(lead.nextContactAt!)}
                  </time>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="large-empty">
            <span className="empty-icon">
              <CalendarClock size={26} />
            </span>
            <h3>Un próximo paso para cada lead</h3>
            <p>Programa un contacto desde su ficha y lo verás aquí.</p>
            <button className="secondary" onClick={onPipeline}>
              Ir al embudo <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
      <section
        className="board-section overview-panel"
        aria-labelledby="overview-leads-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="overview-leads-title">Oportunidades actualizadas</h2>
            <p>Retoma el contexto de los contactos más recientes.</p>
          </div>
          <button className="text-button" onClick={onPipeline}>
            Ver embudo <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="large-empty">
            <LoaderCircle className="spin" />
            <p>Cargando oportunidades…</p>
          </div>
        ) : leads.length ? (
          <div className="overview-rows">
            {leads.slice(0, 5).map((lead) => (
              <button
                className="overview-row"
                key={lead.id}
                onClick={() => onOpen(lead.id)}
              >
                <span className="overview-row-icon">
                  <Users size={19} />
                </span>
                <span className="overview-row-content">
                  <strong>{lead.name}</strong>
                  <small>
                    {lead.source || "Sin canal"} · {labels[lead.stage]}
                  </small>
                  <time>{date(lead.updatedAt)}</time>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="large-empty">
            <span className="empty-icon">
              <LayoutGrid size={26} />
            </span>
            <h3>Tu proceso de ventas, en su lugar</h3>
            <p>
              En Embudo de ventas puedes organizar los leads por etapa y
              consultar su historial.
            </p>
            <button className="secondary" onClick={onPipeline}>
              Abrir embudo <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
