import { useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import SourceLabel from "./SourceLabel";
import { matchesAttention, type AttentionFilter } from "../shared/attention";
import { type Lead, type Stage } from "../shared/types";
interface Props {
  leads: Lead[];
  labels: Record<Stage, string>;
  loading: boolean;
  unavailable: boolean;
  unreviewed: ReadonlySet<string>;
  now: number;
  onOpen: (id: string) => void;
  onFilter: (filter: AttentionFilter) => void;
  onPipeline: () => void;
}
const queues = [
  { key: "pending", label: "Por atender" },
  { key: "followups", label: "Seguimientos" },
  { key: "closing", label: "Por cerrar" },
] as const;
type Queue = (typeof queues)[number]["key"];
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export default function Overview({
  leads,
  labels,
  loading,
  unavailable,
  unreviewed,
  now,
  onOpen,
  onFilter,
  onPipeline,
}: Props) {
  const [selectedQueue, setQueue] = useState<Queue | null>(null);
  const queue =
    selectedQueue ??
    (leads.some((lead) => matchesAttention(lead, "pending", unreviewed))
      ? "pending"
      : leads.some(
            (lead) =>
              matchesAttention(lead, "followups", unreviewed) &&
              lead.nextContactAt &&
              Date.parse(lead.nextContactAt) < now,
          )
        ? "followups"
        : leads.some((lead) => lead.stage === "closing")
          ? "closing"
          : leads.some((lead) =>
                matchesAttention(lead, "followups", unreviewed),
              )
            ? "followups"
            : "pending");
  const tabsRef = useRef<HTMLDivElement>(null);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const priority = (lead: Lead) => {
    if (lead.nextContactAt && Date.parse(lead.nextContactAt) < now) return 0;
    if (
      lead.nextContactAt &&
      Date.parse(lead.nextContactAt) <= endOfToday.getTime()
    )
      return 1;
    if (!lead.nextContactAt) return 2;
    return 3;
  };
  const items = leads
    .filter((lead) => matchesAttention(lead, queue, unreviewed))
    .sort((a, b) => {
      if (queue === "pending")
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return (
        priority(a) - priority(b) ||
        Date.parse(a.nextContactAt || a.createdAt) -
          Date.parse(b.nextContactAt || b.createdAt)
      );
    });
  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % queues.length;
    else if (event.key === "ArrowLeft")
      next = (index + queues.length - 1) % queues.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = queues.length - 1;
    else return;
    event.preventDefault();
    setQueue(queues[next].key);
    tabsRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }
  if (unavailable)
    return (
      <div className="data-unavailable" role="status">
        <CalendarClock size={26} />
        <h2>No se pudo cargar la operación</h2>
        <p>Usa Actualizar para consultar los leads.</p>
      </div>
    );
  return (
    <div className="sales-home">
      <section className="sales-queue" aria-labelledby="sales-queue-title">
        <div className="sales-queue-heading">
          <h2 id="sales-queue-title">A quién contactar</h2>
          <button
            className="text-button unread-link"
            disabled={loading}
            onClick={() => onFilter("unreviewed")}
            title="Fichas sin revisar en este CRM; no equivale a una respuesta pendiente de WhatsApp."
          >
            Sin revisar en CRM{" "}
            <strong>
              {loading
                ? "—"
                : leads.filter((lead) =>
                    matchesAttention(lead, "unreviewed", unreviewed),
                  ).length}
            </strong>
            <ArrowRight size={14} />
          </button>
        </div>
        <div
          className="sales-tabs"
          role="tablist"
          aria-label="Prioridades comerciales"
          ref={tabsRef}
        >
          {queues.map((item, index) => (
            <button
              key={item.key}
              id={`queue-tab-${item.key}`}
              role="tab"
              aria-selected={queue === item.key}
              aria-controls="sales-queue-panel"
              tabIndex={queue === item.key ? 0 : -1}
              onClick={() => setQueue(item.key)}
              onKeyDown={(event) => changeTab(event, index)}
            >
              {item.label}
              <span>
                {loading
                  ? "—"
                  : leads.filter((lead) =>
                      matchesAttention(lead, item.key, unreviewed),
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <div
          id="sales-queue-panel"
          role="tabpanel"
          aria-labelledby={`queue-tab-${queue}`}
          className="sales-queue-panel"
          tabIndex={0}
        >
          {loading ? (
            <div className="sales-empty" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>Cargando leads…</p>
            </div>
          ) : items.length ? (
            <div className="sales-leads">
              {items.slice(0, 6).map((lead) => {
                const late = Boolean(
                  lead.nextContactAt && Date.parse(lead.nextContactAt) < now,
                );
                const action =
                  queue === "pending"
                    ? lead.stage === "new"
                      ? "Dar primera atención"
                      : "Revisar conversación"
                    : queue === "closing"
                      ? "Concretar el pedido"
                      : lead.nextContactAt
                        ? late
                          ? "Retomar seguimiento"
                          : "Contactar según lo acordado"
                        : "Programar próximo contacto";
                return (
                  <button
                    key={lead.id}
                    className="sales-lead"
                    onClick={() => onOpen(lead.id)}
                    aria-label={`Ver detalle de ${lead.name}`}
                  >
                    <span
                      className={`sales-lead-icon ${late ? "is-overdue" : ""}`}
                      aria-hidden="true"
                    >
                      {late ? (
                        <Clock3 size={18} />
                      ) : queue === "pending" ? (
                        <MessageSquare size={18} />
                      ) : (
                        <CalendarClock size={18} />
                      )}
                    </span>
                    <span className="sales-lead-identity">
                      <strong>{lead.name}</strong>
                      <span>
                        {lead.source && <SourceLabel source={lead.source} />}
                        <span className="sales-stage">
                          {labels[lead.stage]}
                        </span>
                      </span>
                    </span>
                    <span className="sales-next-action">
                      <strong>{action}</strong>
                      {lead.nextContactAt ? (
                        <time
                          dateTime={lead.nextContactAt}
                          className={late ? "late" : ""}
                        >
                          {late && "Vencido · "}
                          {formatDate(lead.nextContactAt)}
                        </time>
                      ) : queue !== "pending" ? (
                        <span>Sin fecha de seguimiento</span>
                      ) : null}
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="sales-empty">
              <Check size={25} />
              <h3>
                {queue === "pending"
                  ? "No hay leads por atender"
                  : queue === "followups"
                    ? "No hay seguimientos pendientes"
                    : "No hay pedidos en cierre"}
              </h3>
              <p>
                {queue === "pending"
                  ? "Los leads nuevos y las fichas sin revisar aparecerán aquí."
                  : queue === "followups"
                    ? "Aquí verás los contactos programados y las conversaciones que necesitan una próxima fecha."
                    : "Al mover un lead a Pedido en cierre aparecerá aquí."}
              </p>
            </div>
          )}
        </div>
        {!loading && items.length > 0 && (
          <div className="sales-queue-footer">
            <span>
              {items.length > 6
                ? `6 de ${items.length} leads`
                : `${items.length} lead${items.length === 1 ? "" : "s"}`}
            </span>
            <button className="text-button" onClick={() => onFilter(queue)}>
              Ver todos <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>
      <div className="sales-home-footer">
        <div
          className="sales-results"
          role="group"
          aria-label="Resultados registrados"
        >
          <span>Resultados registrados</span>
          <span>
            Primera compra{" "}
            <strong>
              {loading
                ? "—"
                : leads.filter((lead) => lead.stage === "won").length}
            </strong>
          </span>
          <span>
            Recurrentes{" "}
            <strong>
              {loading
                ? "—"
                : leads.filter((lead) => lead.stage === "recurring").length}
            </strong>
          </span>
        </div>
        <button className="text-button" onClick={onPipeline}>
          Ver embudo <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
