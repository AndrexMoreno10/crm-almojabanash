import Overview from "./Overview";
import { business, whatsappContactUrl } from "../shared/business";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Bot,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  LayoutGrid,
  List,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Assistant, { type MetaStatus } from "./Assistant";
import {
  defaultLabels,
  stages,
  type Activity,
  type Lead,
  type LeadDetail,
  type LeadInput,
  type Settings,
  type Stage,
} from "../shared/types";

const views = [
  "overview",
  "pipeline",
  "followups",
  "contacts",
  "assistant",
] as const;
type View = (typeof views)[number];
const viewLabels: Record<View, string> = {
  overview: "Resumen",
  pipeline: "Embudo de ventas",
  followups: "Seguimientos",
  contacts: "Contactos",
  assistant: "Asistente",
};
function currentView(): View {
  const hash = window.location.hash.slice(1);
  return views.includes(hash as View) ? (hash as View) : "overview";
}
const currency = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const active = (lead: Lead) => lead.stage !== "won" && lead.stage !== "lost";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
const localDate = (iso: string | null) =>
  iso
    ? new Date(
        new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
const blankLead: LeadInput = {
  name: "",
  phone: "",
  email: "",
  source: "",
  campaign: "",
  owner: "",
  stage: "new",
  value: 0,
  nextContactAt: null,
  lostReason: "",
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "No pudimos completar la operación");
  return data as T;
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>({
    stageLabels: defaultLabels,
  });
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [view, setView] = useState<View>(currentView);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialStage, setInitialStage] = useState<Stage>("new");
  const [modal, setModal] = useState<"create" | "settings" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  function navigate(next: View) {
    setView(next);
    window.location.hash = next;
  }
  useEffect(() => {
    const onHashChange = () => setView(currentView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  async function load() {
    try {
      const [data, config, meta] = await Promise.all([
        api<Lead[]>("/leads"),
        api<Settings>("/settings"),
        api<MetaStatus>("/integrations/meta/status"),
      ]);
      setMetaStatus(meta);
      setLeads(data);
      setSettings(config);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const filtered = leads.filter(
    (l) =>
      [l.name, l.phone, l.email, l.campaign, l.owner].some((v) =>
        v.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ) &&
      (!source || l.source === source),
  );
  const open = leads.filter(active);
  const won = leads.filter((l) => l.stage === "won");
  const closed = leads.filter((l) => !active(l));
  const overdue = open.filter(
    (l) => l.nextContactAt && Date.parse(l.nextContactAt) < clock,
  );
  const scheduled = filtered
    .filter((l) => active(l) && l.nextContactAt)
    .sort(
      (a, b) => Date.parse(a.nextContactAt!) - Date.parse(b.nextContactAt!),
    );
  async function saved(message: string) {
    await load();
    setNotice(message);
  }
  async function moveLead(lead: Lead, stage: Stage) {
    if (movingId || lead.stage === stage) return;
    setMovingId(lead.id);
    try {
      await api(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      await saved(`Oportunidad movida a ${settings.stageLabels[stage]}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMovingId(null);
    }
  }
  function exportCsv() {
    const rows = [
      [
        "Nombre",
        "Teléfono",
        "Correo",
        "Canal",
        "Campaña",
        "Responsable",
        "Etapa",
        "Valor estimado",
        "Próximo seguimiento",
      ],
      ...filtered.map((l) => [
        l.name,
        l.phone,
        l.email,
        l.source,
        l.campaign,
        l.owner,
        settings.stageLabels[l.stage],
        String(l.value),
        l.nextContactAt || "",
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (value) =>
                `"${value.replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`,
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "almo-oportunidades.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="Almo: inicio"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-symbol">
            a<span>•</span>
          </span>
          <div>
            almo<span className="brand-caption">ESPACIO COMERCIAL</span>
          </div>
        </a>
        <div className="workspace">
          <span className="workspace-icon">A</span>
          <div>
            {business.name}
            <small>{business.city}</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <span className="nav-label">TU OPERACIÓN</span>
        <nav>
          <NavButton
            icon={<LayoutDashboard size={19} />}
            active={view === "overview"}
            onClick={() => navigate("overview")}
          >
            Resumen
          </NavButton>
          <NavButton
            icon={<LayoutGrid size={19} />}
            active={view === "pipeline"}
            onClick={() => navigate("pipeline")}
          >
            Embudo de ventas <span className="nav-count">{open.length}</span>
          </NavButton>
          <NavButton
            icon={<CalendarClock size={19} />}
            active={view === "followups"}
            onClick={() => navigate("followups")}
          >
            Seguimientos{" "}
            {overdue.length > 0 && (
              <span className="nav-alert">{overdue.length}</span>
            )}
          </NavButton>
          <NavButton
            icon={<Users size={19} />}
            active={view === "contacts"}
            onClick={() => navigate("contacts")}
          >
            Contactos
          </NavButton>
          <NavButton
            icon={<Bot size={19} />}
            active={view === "assistant"}
            onClick={() => navigate("assistant")}
          >
            Asistente de ventas
          </NavButton>
        </nav>
        <div className="sidebar-tip">
          <Sparkles size={21} />
          <strong>Cada conversación cuenta.</strong>
          <p>
            Un próximo paso claro te ayuda a mantener viva cada oportunidad.
          </p>
          <button onClick={() => navigate("followups")}>
            Ver seguimientos <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            aria-label="Configurar etapas"
            title="Configurar etapas"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={18} /> Configurar etapas
          </button>
          <div className="profile">
            <span className="avatar">EQ</span>
            <div>
              Equipo comercial<small>Espacio de desarrollo</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Espacio de trabajo <ChevronRight size={13} />{" "}
            <strong>{viewLabels[view]}</strong>
          </div>
          <span className="manual-indicator">
            <span /> Registro manual
          </span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MENOS OPORTUNIDADES OLVIDADAS</div>
              <h1>
                {view === "overview"
                  ? "Tu operación, de un vistazo."
                  : view === "pipeline"
                    ? "Embudo de ventas"
                    : view === "followups"
                      ? "El siguiente paso importa."
                      : view === "assistant"
                        ? "Atención con un siguiente paso."
                        : "Personas, antes que números."}
              </h1>
              <p>
                {view === "overview"
                  ? "Revisa tus indicadores y decide a qué conversaciones dar prioridad."
                  : view === "pipeline"
                    ? "Organiza tus contactos y acompaña cada oportunidad hasta el cierre."
                    : view === "followups"
                      ? "Retoma las conversaciones pendientes y mantén el ritmo de tu equipo."
                      : view === "assistant"
                        ? "Prueba cómo acompañaremos a los interesados en compras al por mayor."
                        : "Encuentra la información y el contexto de cada oportunidad."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setInitialStage("new");
                setModal("create");
              }}
            >
              <Plus size={18} /> Nueva oportunidad
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => void load()}>Reintentar</button>
            </div>
          )}
          {view === "overview" && (
            <section className="metrics" aria-label="Resumen comercial">
              <Metric
                label="Oportunidades abiertas"
                value={String(open.length)}
                icon={<Users size={19} />}
                foot="Contactos por acompañar"
              />
              <Metric
                label="Valor en oportunidades"
                value={currency(open.reduce((sum, l) => sum + l.value, 0))}
                icon={<TrendingUp size={19} />}
                foot="Suma de valores estimados"
              />
              <Metric
                label="Tasa de cierre"
                value={
                  closed.length
                    ? `${Math.round((won.length / closed.length) * 100)}%`
                    : "—"
                }
                icon={<Target size={19} />}
                foot={
                  closed.length
                    ? `${won.length} ganadas de ${closed.length} cerradas`
                    : "Aún no hay oportunidades cerradas"
                }
              />
              <Metric
                label="Seguimientos vencidos"
                value={String(overdue.length)}
                icon={<Clock3 size={19} />}
                foot={
                  overdue.length
                    ? "Es momento de retomar el contacto"
                    : "Sin seguimientos vencidos"
                }
                accent={overdue.length > 0}
              />
            </section>
          )}
          {view === "overview" ? (
            <Overview
              leads={leads}
              labels={settings.stageLabels}
              loading={loading}
              now={clock}
              onOpen={setSelected}
              onPipeline={() => navigate("pipeline")}
              onFollowups={() => navigate("followups")}
            />
          ) : view === "assistant" ? (
            <Assistant status={metaStatus} />
          ) : (
            <section className="board-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {view === "pipeline"
                      ? "Tu embudo de ventas"
                      : view === "followups"
                        ? "Agenda de seguimiento"
                        : "Todos tus contactos"}{" "}
                    <span>
                      {view === "followups" ? scheduled.length : leads.length}
                    </span>
                  </h2>
                  <p>
                    {view === "pipeline"
                      ? "Arrastra una tarjeta o cambia su etapa. Cada movimiento queda en el historial."
                      : view === "followups"
                        ? "Ordenados por la fecha del próximo contacto."
                        : "Toda tu información comercial en un solo lugar."}
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={exportCsv}
                  disabled={!filtered.length}
                >
                  <ArrowDownToLine size={16} /> Exportar
                </button>
              </div>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Buscar oportunidades"
                    placeholder="Buscar nombre, teléfono, campaña..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Limpiar búsqueda"
                      onClick={() => setSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Filtrar por canal"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">Todos los canales</option>
                  {[...new Set(leads.map((l) => l.source).filter(Boolean))]
                    .sort()
                    .map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
                <div className="view-toggle">
                  <button
                    className={view === "pipeline" ? "chosen" : ""}
                    aria-label="Vista de tablero"
                    onClick={() => navigate("pipeline")}
                  >
                    <LayoutGrid size={17} />
                  </button>
                  <button
                    className={view === "contacts" ? "chosen" : ""}
                    aria-label="Vista de lista"
                    onClick={() => navigate("contacts")}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
              {loading ? (
                <div className="large-empty">
                  <LoaderCircle className="spin" />
                  <p>Cargando tu espacio…</p>
                </div>
              ) : view === "pipeline" ? (
                <div className="kanban">
                  {stages.map((stage) => {
                    const items = filtered.filter((l) => l.stage === stage);
                    return (
                      <section
                        className={`kanban-column stage-${stage}`}
                        aria-label={settings.stageLabels[stage]}
                        onDragOver={(e) => {
                          if (!movingId) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const lead = leads.find(
                            (l) =>
                              l.id === e.dataTransfer.getData("text/plain"),
                          );
                          if (lead) void moveLead(lead, stage);
                        }}
                        key={stage}
                      >
                        <div className="column-heading">
                          <div>
                            <span className="stage-dot" />
                            <h3>{settings.stageLabels[stage]}</h3>
                            <span className="column-count">{items.length}</span>
                          </div>
                          <button
                            aria-label={`Crear oportunidad en ${settings.stageLabels[stage]}`}
                            onClick={() => {
                              setInitialStage(stage);
                              setModal("create");
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="column-value">
                          {currency(items.reduce((sum, l) => sum + l.value, 0))}{" "}
                          <span>valor estimado</span>
                        </div>
                        <div className="column-cards">
                          {items.map((lead) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              clock={clock}
                              labels={settings.stageLabels}
                              moving={Boolean(movingId)}
                              onMove={(stage) => void moveLead(lead, stage)}
                              onClick={() => setSelected(lead.id)}
                            />
                          ))}
                          {items.length === 0 && (
                            <div className="column-empty">
                              <span className="empty-lines">
                                <span />
                                <span />
                                <span />
                              </span>
                              <p>
                                {stage === "new"
                                  ? "Aquí empieza una nueva conversación"
                                  : stage === "won"
                                    ? "Aquí celebraremos los cierres"
                                    : stage === "lost"
                                      ? "Cada resultado deja un aprendizaje"
                                      : "Espacio para el siguiente paso"}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : view === "followups" ? (
                <div className="followup-list">
                  {scheduled.length ? (
                    scheduled.map((l) => (
                      <button
                        key={l.id}
                        className="followup-row"
                        onClick={() => setSelected(l.id)}
                      >
                        <span
                          className={`followup-icon ${Date.parse(l.nextContactAt!) < clock ? "late" : ""}`}
                        >
                          <CalendarClock size={21} />
                        </span>
                        <div>
                          <strong>{l.name}</strong>
                          <small>
                            {l.owner || "Sin responsable"} ·{" "}
                            {settings.stageLabels[l.stage]}
                          </small>
                        </div>
                        <time
                          className={
                            Date.parse(l.nextContactAt!) < clock ? "late" : ""
                          }
                        >
                          {dateLabel(l.nextContactAt!)}
                        </time>
                        <ArrowUpRight size={18} />
                      </button>
                    ))
                  ) : (
                    <Empty
                      icon={<CalendarClock size={26} />}
                      title="Dale una fecha al próximo paso"
                      text="Abre una oportunidad y programa cuándo volverás a contactar a esa persona."
                    />
                  )}
                  <div className="followup-footnote">
                    Los seguimientos se muestran dentro del CRM. Aún no se
                    envían recordatorios externos.
                  </div>
                </div>
              ) : (
                <div className="table-wrap">
                  {filtered.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Contacto</th>
                          <th>Canal / campaña</th>
                          <th>Etapa</th>
                          <th>Responsable</th>
                          <th>Valor estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <button
                                className="contact-link"
                                onClick={() => setSelected(l.id)}
                              >
                                <strong>{l.name}</strong>
                                <small>
                                  {l.phone ||
                                    l.email ||
                                    "Sin datos de contacto"}
                                </small>
                              </button>
                            </td>
                            <td>
                              {l.source || "Sin canal"}
                              <small>{l.campaign}</small>
                            </td>
                            <td>
                              <span className={`stage-pill stage-${l.stage}`}>
                                {settings.stageLabels[l.stage]}
                              </span>
                            </td>
                            <td>{l.owner || "Sin asignar"}</td>
                            <td>{currency(l.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Empty
                      icon={<Users size={26} />}
                      title="Tu próxima venta empieza con un contacto"
                      text="Registra tu primera oportunidad para empezar a construir su historia."
                    />
                  )}
                </div>
              )}
              {!loading && !leads.length && view === "pipeline" && (
                <div className="first-step">
                  <span className="first-step-icon">
                    <MessageSquare size={23} />
                  </span>
                  <div>
                    <strong>Todo empieza con una conversación.</strong>
                    <p>
                      Agrega tu primera oportunidad y define cuándo volver a
                      contactar.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setInitialStage("new");
                      setModal("create");
                    }}
                  >
                    Agregar contacto <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <CircleHelp size={15} /> Las etapas son configurables. Los canales
              de mensajería aún no están conectados.
            </span>
            <span>Almo · Un paso más cerca.</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {modal === "create" && (
        <LeadForm
          initialStage={initialStage}
          onClose={() => setModal(null)}
          onSave={async (input) => {
            await api("/leads", {
              method: "POST",
              body: JSON.stringify(input),
            });
            setModal(null);
            navigate("pipeline");
            await saved("Oportunidad creada");
          }}
          labels={settings.stageLabels}
        />
      )}
      {modal === "settings" && (
        <SettingsForm
          settings={settings}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            await api("/settings", {
              method: "PUT",
              body: JSON.stringify(data),
            });
            setModal(null);
            await saved("Etapas actualizadas");
          }}
        />
      )}
      {selected && (
        <Detail
          key={selected}
          id={selected}
          labels={settings.stageLabels}
          onClose={() => setSelected(null)}
          onChange={() => saved("Cambios guardados")}
        />
      )}
    </div>
  );
}

function NavButton({
  icon,
  children,
  active,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      aria-label={Children.toArray(children)
        .filter((child) => typeof child === "string")
        .join("")
        .trim()}
      title={Children.toArray(children)
        .filter((child) => typeof child === "string")
        .join("")
        .trim()}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
function Metric({
  label,
  value,
  icon,
  foot,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  foot: string;
  accent?: boolean;
}) {
  return (
    <article className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </article>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="large-empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function LeadCard({
  lead,
  clock,
  onClick,
  labels,
  moving,
  onMove,
}: {
  lead: Lead;
  clock: number;
  labels: Record<Stage, string>;
  moving: boolean;
  onMove: (stage: Stage) => void;
  onClick: () => void;
}) {
  const late =
    active(lead) &&
    lead.nextContactAt &&
    Date.parse(lead.nextContactAt) < clock;
  return (
    <article
      className="lead-card"
      draggable={!moving}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <button className="lead-card-open" onClick={onClick}>
        <div className="card-top">
          <span className="source-tag">{lead.source || "Sin canal"}</span>
          <ArrowUpRight size={15} />
        </div>
        <h4>{lead.name}</h4>
        <p>{lead.campaign || "Sin campaña asociada"}</p>
        <strong className="card-value">
          {currency(lead.value)} <small>valor estimado</small>
        </strong>
        {lead.nextContactAt && active(lead) && (
          <div className={`card-followup ${late ? "late" : ""}`}>
            <Clock3 size={13} />
            {late ? "Seguimiento vencido" : dateLabel(lead.nextContactAt)}
          </div>
        )}
        <div className="card-bottom">
          <span className="small-avatar">
            {lead.owner ? initials(lead.owner) : "—"}
          </span>
          <span>{lead.owner || "Sin responsable"}</span>
          <ChevronRight size={14} />
        </div>
      </button>
      <label className="quick-stage">
        <span>Etapa</span>
        <select
          aria-label={`Etapa de ${lead.name}`}
          value={lead.stage}
          disabled={moving}
          onChange={(e) => onMove(e.target.value as Stage)}
        >
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {labels[stage]}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? cloneElement(
              child as ReactElement<{ "aria-labelledby"?: string }>,
              { "aria-labelledby": id },
            )
          : child,
      )}
    </label>
  );
}
function LeadFields({
  input,
  setInput,
  labels,
}: {
  input: LeadInput;
  setInput: (value: LeadInput) => void;
  labels: Record<Stage, string>;
}) {
  const update = (key: keyof LeadInput, value: string | number | null) =>
    setInput({ ...input, [key]: value });
  return (
    <div className="form-grid">
      <Field label="Nombre del contacto *">
        <input
          name="name"
          autoComplete="name"
          required
          maxLength={160}
          value={input.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Nombre o empresa"
        />
      </Field>
      <Field label="Responsable">
        <input
          maxLength={100}
          value={input.owner}
          onChange={(e) => update("owner", e.target.value)}
          placeholder="¿Quién acompaña esta venta?"
        />
      </Field>
      <Field label="Teléfono">
        <input
          type="tel"
          autoComplete="tel"
          maxLength={40}
          value={input.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="Incluye el indicativo del país"
        />
      </Field>
      <Field label="Correo electrónico">
        <input
          type="email"
          autoComplete="email"
          maxLength={254}
          value={input.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="correo@ejemplo.com"
        />
      </Field>
      <Field label="Canal de origen">
        <input
          list="source-options"
          maxLength={100}
          value={input.source}
          onChange={(e) => update("source", e.target.value)}
          placeholder="Selecciona o escribe un canal"
        />
        <datalist id="source-options">
          <option>WhatsApp</option>
          <option>Instagram</option>
          <option>Facebook</option>
          <option>Referido</option>
          <option>Otro</option>
        </datalist>
      </Field>
      <Field label="Campaña">
        <input
          maxLength={160}
          value={input.campaign}
          onChange={(e) => update("campaign", e.target.value)}
          placeholder="Nombre de la campaña, si aplica"
        />
      </Field>
      <Field label="Etapa">
        <select
          value={input.stage}
          onChange={(e) => update("stage", e.target.value)}
        >
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {labels[stage]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Valor estimado (opcional)">
        <input
          type="number"
          min="0"
          max="1000000000000"
          step="any"
          value={input.value}
          onChange={(e) => update("value", Number(e.target.value))}
        />
      </Field>
      <Field label="Próximo contacto (hora de tu navegador)">
        <input
          type="datetime-local"
          value={localDate(input.nextContactAt)}
          onChange={(e) =>
            update(
              "nextContactAt",
              e.target.value ? new Date(e.target.value).toISOString() : null,
            )
          }
        />
      </Field>
      {input.stage === "lost" && (
        <Field label="Motivo de pérdida">
          <input
            maxLength={1000}
            value={input.lostReason}
            onChange={(e) => update("lostReason", e.target.value)}
            placeholder="¿Qué podemos aprender?"
          />
        </Field>
      )}
    </div>
  );
}
function LeadForm({
  initialStage,
  labels,
  onClose,
  onSave,
}: {
  initialStage: Stage;
  labels: Record<Stage, string>;
  onClose: () => void;
  onSave: (data: LeadInput) => Promise<void>;
}) {
  const [input, setInput] = useState<LeadInput>({
    ...blankLead,
    stage: initialStage,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(input);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Nueva oportunidad"
      subtitle="Un contacto, un contexto y un siguiente paso."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <LeadFields input={input} setInput={setInput} labels={labels} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Crear oportunidad"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SettingsForm({
  settings,
  onClose,
  onSave,
}: {
  settings: Settings;
  onClose: () => void;
  onSave: (data: Settings) => Promise<void>;
}) {
  const [labels, setLabels] = useState({ ...settings.stageLabels });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ stageLabels: labels });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Etapas de tu proceso"
      subtitle="Estos nombres iniciales son una propuesta. Ajústalos a tu operación."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="settings-fields">
          {stages.map((stage, i) => (
            <Field
              label={`${i + 1}. ${stage === "won" ? "Cierre ganado" : stage === "lost" ? "Cierre perdido" : "Etapa abierta"}`}
              key={stage}
            >
              <input
                required
                maxLength={50}
                value={labels[stage]}
                onChange={(e) =>
                  setLabels({ ...labels, [stage]: e.target.value })
                }
              />
            </Field>
          ))}
        </div>
        <p className="form-hint">
          Las últimas dos etapas representan ventas ganadas y perdidas para
          calcular la tasa de cierre.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar etapas"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Detail({
  id,
  labels,
  onClose,
  onChange,
}: {
  id: string;
  labels: Record<Stage, string>;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [conversation, setConversation] = useState<{
    session: import("../server/bot").BotSession | null;
    messages: {
      id: string;
      direction: string;
      body: string;
      state: string;
      createdAt: string;
    }[];
  } | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [draft, setDraft] = useState<LeadInput>(blankLead);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [data, messages] = await Promise.all([
      api<LeadDetail>(`/leads/${id}`),
      api<NonNullable<typeof conversation>>(`/leads/${id}/messages`),
    ]);
    setDetail(data);
    setConversation(messages);
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      ...input
    } = data.lead;
    setDraft(input);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [id]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      await refresh();
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addNote(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/leads/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: note }),
      });
      setNote("");
      const [data, messages] = await Promise.all([
        api<LeadDetail>(`/leads/${id}`),
        api<NonNullable<typeof conversation>>(`/leads/${id}/messages`),
      ]);
      setDetail(data);
      setConversation(messages);
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={detail?.lead.name || "Oportunidad"}
      subtitle="La información que necesitas para continuar la conversación."
      onClose={onClose}
      wide
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {detail ? (
        <div className="detail-layout">
          <form onSubmit={save}>
            <LeadFields input={draft} setInput={setDraft} labels={labels} />
            <div className="manual-whatsapp">
              {whatsappContactUrl(draft.phone) ? (
                <a
                  className="secondary whatsapp-action"
                  href={whatsappContactUrl(draft.phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare size={16} /> Abrir conversación en WhatsApp
                </a>
              ) : (
                <p>
                  Para abrir WhatsApp, guarda el teléfono con indicativo
                  internacional.
                </p>
              )}
              <p>
                La respuesta se hace en WhatsApp. Registra aquí las notas y el
                siguiente paso; los mensajes de la aplicación Business todavía
                no se sincronizan.
              </p>
            </div>
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
          <section className="activity-section">
            {conversation?.session && (
              <div className="buyer-summary">
                <strong>
                  {conversation.session.state === "opted_out"
                    ? "Seguimiento automático detenido"
                    : ["human", "ready"].includes(conversation.session.state)
                      ? "Atención del equipo pendiente"
                      : "Solicitud en curso"}
                </strong>
                {conversation.session.profile.segment && (
                  <p>
                    Tipo de comprador: {conversation.session.profile.segment}
                  </p>
                )}
                {conversation.session.profile.quantity && (
                  <p>
                    Unidades de interés: {conversation.session.profile.quantity}
                  </p>
                )}
                {conversation.session.profile.city && (
                  <p>Ciudad: {conversation.session.profile.city}</p>
                )}
                {conversation.session.profile.sampleRequested !== undefined && (
                  <p>
                    Muestra:{" "}
                    {conversation.session.profile.sampleRequested
                      ? "Solicitada, pendiente de aprobación"
                      : "No solicitada"}
                  </p>
                )}
              </div>
            )}
            <h3>
              <MessageSquare size={18} /> Historial y notas
            </h3>
            <p className="form-hint">
              Registro interno. No envía mensajes al contacto.
            </p>
            <form onSubmit={addNote}>
              <textarea
                aria-label="Nueva nota"
                placeholder="¿Qué hablaron? ¿Qué falta para avanzar?"
                maxLength={4000}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="secondary" disabled={busy || !note.trim()}>
                <Plus size={15} /> Agregar nota
              </button>
            </form>
            <div className="meta-conversation">
              {conversation?.messages.length ? (
                <>
                  <h4>Conversación de WhatsApp</h4>
                  {conversation.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`chat-message chat-${m.direction === "inbound" ? "user" : "bot"}`}
                    >
                      <small>
                        {m.direction === "inbound" ? "Cliente" : "Asistente"} ·{" "}
                        {(
                          {
                            draft: "Borrador, sin enviar",
                            received: "Recibido",
                            sent: "Enviado",
                            failed: "Envío fallido",
                            unknown: "Envío por verificar",
                            cancelled: "Cancelado",
                            expired: "Borrador vencido",
                            sending: "En proceso",
                          } as Record<string, string>
                        )[m.state] || m.state}
                      </small>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </>
              ) : null}
            </div>
            <div className="timeline">
              {detail.activities.map((a: Activity) => (
                <article key={a.id} className={`activity activity-${a.kind}`}>
                  <span className="timeline-dot" />
                  <small>{dateLabel(a.createdAt)}</small>
                  <p>{a.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : (
        !error && (
          <div className="large-empty">
            <LoaderCircle className="spin" />
            Cargando oportunidad…
          </div>
        )
      )}
    </Modal>
  );
}
