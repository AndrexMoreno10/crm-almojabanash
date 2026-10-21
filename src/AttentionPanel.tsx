import {
  ArrowUpRight,
  CalendarClock,
  Eye,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  attentionLabels,
  matchesAttention,
  type AttentionFilter,
} from "../shared/attention";
import type { Lead } from "../shared/types";

const actions = [
  {
    key: "unreviewed",
    icon: Eye,
    detail: "Fichas pendientes de abrir o con nuevos mensajes recibidos.",
  },
  {
    key: "new",
    icon: MessageSquare,
    detail: "Leads que siguen en la etapa Nuevo lead.",
  },
  {
    key: "unassigned",
    icon: Users,
    detail: "Oportunidades abiertas sin una persona asignada.",
  },
  {
    key: "unscheduled",
    icon: CalendarClock,
    detail: "Oportunidades abiertas sin fecha de seguimiento.",
  },
] as const;
export default function AttentionPanel({
  leads,
  unreviewed,
  loading,
  unavailable,
  onFilter,
}: {
  leads: Lead[];
  unreviewed: ReadonlySet<string>;
  loading: boolean;
  unavailable: boolean;
  onFilter: (filter: AttentionFilter) => void;
}) {
  return (
    <section className="attention-panel" aria-labelledby="attention-title">
      <div className="attention-heading">
        <h2 id="attention-title">Atención pendiente</h2>
        <span>Elige un grupo para ver los leads</span>
      </div>
      <div className="attention-actions">
        {actions.map(({ key, icon: Icon, detail }) => (
          <button
            key={key}
            className={`attention-action attention-${key}`}
            disabled={loading || unavailable}
            title={detail}
            onClick={() => onFilter(key)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>
              <span>{attentionLabels[key]}</span>
              <strong>
                {loading || unavailable
                  ? "—"
                  : leads.filter((lead) =>
                      matchesAttention(lead, key, unreviewed),
                    ).length}
              </strong>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p>
        Revisar una ficha no confirma una respuesta. La atención se registra
        cambiando su etapa; los mensajes sin leer de Meta aún no están
        sincronizados. Estos grupos pueden compartir leads.
      </p>
    </section>
  );
}
