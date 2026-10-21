import Overview from "./Overview";
import SourceLabel from "./SourceLabel";
import BrandIdentity from "./BrandIdentity";
import {
  attentionLabels,
  matchesAttention,
  type AttentionFilter,
  type AttentionSummary,
} from "../shared/attention";
import { business, whatsappContactUrl } from "../shared/business";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Bot,
  Menu,
  RefreshCw,
  ChevronLeft,
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
  Users,
  X,
} from "lucide-react";
import Assistant, { type MetaStatus } from "./Assistant";
import {
  defaultLabels,
  stages,
  pipelineStages,
  stageHints,
  isOpenStage,
  canFollowUp,
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
  const hash = window.location.hash.slice(1).split("?")[0];
  return views.includes(hash as View) ? (hash as View) : "overview";
}
function currentAttention(): AttentionFilter | null {
  const value = new URLSearchParams(window.location.hash.split("?")[1]).get(
    "attention",
  );
  return value && Object.hasOwn(attentionLabels, value)
    ? (value as AttentionFilter)
    : null;
}
const currency = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const active = (lead: Lead) => isOpenStage(lead.stage);
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) return;
    icon.href = logoUrl || "/favicon.svg";
    if (logoUrl) icon.removeAttribute("type");
    else icon.type = "image/svg+xml";
  }, [logoUrl]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>({
    stageLabels: defaultLabels,
  });
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [view, setView] = useState<View>(currentView);
  const [attentionFilter, setAttentionFilter] =
    useState<AttentionFilter | null>(currentAttention);
  const [attention, setAttention] = useState<AttentionSummary>({
    unreviewedIds: [],
  });
  const unreviewed = new Set(attention.unreviewedIds);
  const [search, setSearch] = useState("");
  const [showLost, setShowLost] = useState(false);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialStage, setInitialStage] = useState<Stage>("new");
  const [modal, setModal] = useState<"create" | "settings" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [clock, setClock] = useState(Date.now());
  function navigate(next: View, filter: AttentionFilter | null = null) {
    setMenuOpen(false);
    setAttentionFilter(filter);
    if (next === "pipeline") setShowLost(false);
    setView(next);
    window.location.hash = filter ? `${next}?attention=${filter}` : next;
  }
  function openAttention(filter: AttentionFilter) {
    setSearch("");
    setSource("");
    navigate("contacts", filter);
  }
  useEffect(() => {
    const onHashChange = () => {
      setView(currentView());
      setAttentionFilter(currentAttention());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nav = document.querySelector<HTMLElement>(".sidebar");
    nav?.querySelector<HTMLButtonElement>(".mobile-nav-close")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        const focusable = Array.from(
          nav?.querySelectorAll<HTMLElement>("button,a[href]") || [],
        ).filter((el) => el.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth > 900) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);
  async function load() {
    try {
      const [data, config, meta, attentionData] = await Promise.all([
        api<Lead[]>("/leads"),
        api<Settings>("/settings"),
        api<MetaStatus>("/integrations/meta/status"),
        api<AttentionSummary>("/attention"),
      ]);
      setAttention(attentionData);
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
      (!attentionFilter || matchesAttention(l, attentionFilter, unreviewed)) &&
      [l.name, l.phone, l.email, l.campaign, l.owner].some((v) =>
        v.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ) &&
      (!source || l.source === source),
  );
  const open = leads.filter(active);
  const lost = filtered.filter((l) => l.stage === "lost");
  const overdue = leads.filter(
    (l) =>
      canFollowUp(l.stage) &&
      l.nextContactAt &&
      Date.parse(l.nextContactAt) < clock,
  );
  const scheduled = filtered
    .filter((l) => canFollowUp(l.stage) && l.nextContactAt)
    .sort(
      (a, b) => Date.parse(a.nextContactAt!) - Date.parse(b.nextContactAt!),
    );
  async function saved(message: string) {
    await load();
    setNotice(message);
  }
  async function moveLead(lead: Lead, stage: Stage) {
    if (movingId || lead.stage === stage) return;
    const restoreFocus =
      document.activeElement?.getAttribute("data-stage-lead") === lead.id;
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
      if (restoreFocus)
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLSelectElement>(
            `select[data-stage-lead="${lead.id}"]`,
          );
          if (target) target.focus();
          else
            document.querySelector<HTMLButtonElement>(".lost-toggle")?.focus();
        });
    }
  }
  async function changeSource(lead: Lead, source: string) {
    if (movingId || !source) return;
    setMovingId(lead.id);
    try {
      const updated = await api<Lead>(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ source }),
      });
      setLeads((before) =>
        before.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Canal actualizado");
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(`[data-lead-open="${lead.id}"]`)
          ?.focus(),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setMovingId(null);
    }
  }
  const exportable =
    view === "pipeline"
      ? filtered.filter((lead) =>
          showLost ? lead.stage === "lost" : lead.stage !== "lost",
        )
      : view === "followups"
        ? scheduled
        : filtered;
  async function refreshAll() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
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
      ...exportable.map((l) => [
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
    <div
      className={`app-shell ${menuOpen ? "nav-open" : ""} ${view === "pipeline" ? "pipeline-workspace" : view === "overview" ? "overview-page" : ""}`}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {menuOpen && (
        <button
          className="nav-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className="sidebar"
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen || undefined}
        aria-label="Navegación principal"
        inert={
          (mobile && !menuOpen) ||
          Boolean(modal) ||
          Boolean(selected) ||
          undefined
        }
      >
        <button
          className="mobile-nav-close icon-button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        >
          <X size={20} />
        </button>
        <BrandIdentity
          onHome={() => navigate("overview")}
          onLogoChange={setLogoUrl}
        />
        <div className="workspace">
          <span className="workspace-icon">A</span>
          <div>
            Sede principal
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
        {view !== "overview" && (
          <div className="sidebar-focus">
            <span className="sidebar-focus-icon">
              <CalendarClock size={21} />
            </span>
            <strong>{overdue.length} pendientes</strong>
            <p>
              {overdue.length
                ? "Seguimientos con fecha vencida."
                : "Sin seguimientos vencidos."}
            </p>
            <button onClick={() => navigate("followups")}>
              Abrir agenda <ArrowRight size={16} />
            </button>
          </div>
        )}
        <div className="sidebar-bottom">
          <button
            aria-label="Configurar etapas"
            title="Configurar etapas"
            onClick={() => {
              setMenuOpen(false);
              setModal("settings");
            }}
          >
            <Settings2 size={18} /> Configurar etapas
          </button>
          <div className="profile">
            <span className="avatar">
              {logoUrl ? (
                <img className="profile-logo" src={logoUrl} alt="" />
              ) : (
                "AH"
              )}
            </span>
            <div>
              Almojábanas Huilenses<small>Armenia, Quindío</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        inert={menuOpen || Boolean(modal) || Boolean(selected) || undefined}
      >
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="menu-trigger icon-button"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Comercial <ChevronRight size={14} />{" "}
            <strong>{viewLabels[view]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="manual-indicator">
              <span /> Modo manual
            </span>
            <button
              className="text-button refresh-button"
              aria-label="Actualizar"
              disabled={refreshing}
              onClick={() => void refreshAll()}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              <span>Actualizar</span>
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              {view !== "pipeline" && view !== "overview" && (
                <div className="eyebrow">
                  ALMOJÁBANAS HUILENSES <span>/ COMERCIAL</span>
                </div>
              )}
              <h1>
                {view === "overview"
                  ? "Panel comercial"
                  : view === "pipeline"
                    ? "Embudo de ventas"
                    : view === "followups"
                      ? "Agenda de seguimiento"
                      : view === "assistant"
                        ? "Asistente comercial"
                        : "Contactos"}
              </h1>
              {view === "pipeline" && (
                <span className="pipeline-total">
                  {loading
                    ? "…"
                    : leads.filter((lead) =>
                        showLost
                          ? lead.stage === "lost"
                          : lead.stage !== "lost",
                      ).length}{" "}
                  leads
                </span>
              )}
              {view !== "pipeline" && (
                <p>
                  {view === "overview"
                    ? "Responde, retoma y concreta el próximo pedido."
                    : view === "followups"
                      ? "Retoma las conversaciones pendientes y mantén el ritmo de tu equipo."
                      : view === "assistant"
                        ? "Prueba cómo acompañaremos a los interesados en compras al por mayor."
                        : "Encuentra la información y el contexto de cada oportunidad."}
                </p>
              )}
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
          {view === "overview" ? (
            <Overview
              leads={leads}
              labels={settings.stageLabels}
              unavailable={Boolean(error)}
              loading={loading}
              now={clock}
              onOpen={setSelected}
              unreviewed={unreviewed}
              onFilter={openAttention}
              onPipeline={() => navigate("pipeline")}
            />
          ) : view === "assistant" ? (
            <Assistant status={metaStatus} />
          ) : (
            <section
              className={`board-section ${view === "pipeline" ? "pipeline-board" : ""}`}
            >
              <div
                className={view === "pipeline" ? "sr-only" : "section-heading"}
              >
                <div>
                  <h2>
                    {view === "pipeline"
                      ? showLost
                        ? "Oportunidades perdidas"
                        : "Tu embudo de ventas"
                      : view === "followups"
                        ? "Agenda de seguimiento"
                        : attentionFilter
                          ? attentionLabels[attentionFilter]
                          : "Todos tus contactos"}{" "}
                    <span>
                      {view === "followups"
                        ? scheduled.length
                        : view === "pipeline"
                          ? showLost
                            ? lost.length
                            : leads.filter((l) => l.stage !== "lost").length
                          : filtered.length}
                    </span>
                  </h2>
                  <p>
                    {view === "pipeline"
                      ? showLost
                        ? "Conserva el motivo y el historial; recupera un contacto si vuelve a interesarse."
                        : "Ocho etapas para acompañar cada lead. Arrastra las tarjetas o cambia su etapa; desliza para ver todo el recorrido."
                      : view === "followups"
                        ? "Ordenados por la fecha del próximo contacto."
                        : "Toda tu información comercial en un solo lugar."}
                  </p>
                </div>
                {view !== "pipeline" && (
                  <button
                    className="text-button"
                    onClick={exportCsv}
                    disabled={!exportable.length}
                  >
                    <ArrowDownToLine size={16} /> Exportar
                  </button>
                )}
              </div>
              <div className="toolbar">
                {attentionFilter && (
                  <button
                    className="attention-filter secondary"
                    aria-label="Quitar filtro de atención"
                    onClick={() => navigate(view)}
                  >
                    {attentionLabels[attentionFilter]}
                    <X size={14} />
                  </button>
                )}
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
                {view === "pipeline" && (
                  <button
                    className={`secondary lost-toggle ${showLost ? "selected" : ""}`}
                    aria-label={
                      showLost
                        ? "Ver embudo de ocho etapas"
                        : "Ver oportunidades perdidas"
                    }
                    aria-pressed={showLost}
                    onClick={() => setShowLost(!showLost)}
                  >
                    {showLost
                      ? "Volver al embudo"
                      : `Perdidas (${lost.length})`}
                  </button>
                )}
                {view === "pipeline" && !showLost && (
                  <div
                    className="board-scroll-controls"
                    aria-label="Desplazamiento del embudo"
                  >
                    <button
                      className="icon-button"
                      aria-label="Ver etapas anteriores"
                      onClick={() =>
                        boardRef.current?.scrollBy({
                          left: -560,
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                        })
                      }
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Ver etapas siguientes"
                      onClick={() =>
                        boardRef.current?.scrollBy({
                          left: 560,
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                        })
                      }
                    >
                      <ChevronRight size={19} />
                    </button>
                  </div>
                )}
                {view === "pipeline" && (
                  <button
                    className="text-button pipeline-export"
                    onClick={exportCsv}
                    disabled={!exportable.length}
                  >
                    <ArrowDownToLine size={16} /> Exportar
                  </button>
                )}
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
              ) : view === "pipeline" && !showLost ? (
                <div
                  className="kanban"
                  ref={boardRef}
                  role="region"
                  tabIndex={0}
                  aria-label="Embudo con ocho etapas"
                >
                  {pipelineStages.map((stage, index) => {
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
                            <span className="stage-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 title={stageHints[stage]}>
                              {settings.stageLabels[stage]}
                            </h3>
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
                        <div
                          className="column-cards"
                          tabIndex={items.length ? 0 : undefined}
                          role="group"
                          aria-label={`Leads en ${settings.stageLabels[stage]}`}
                        >
                          {items.map((lead) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              clock={clock}
                              labels={settings.stageLabels}
                              moving={Boolean(movingId)}
                              onMove={(stage) => void moveLead(lead, stage)}
                              onSource={(source) =>
                                void changeSource(lead, source)
                              }
                              onClick={() => setSelected(lead.id)}
                            />
                          ))}
                          {items.length === 0 && (
                            <div className="column-empty">
                              <p>
                                {stage === "new"
                                  ? "Sin contactos nuevos"
                                  : stage === "won"
                                    ? "Sin primeras compras"
                                    : stage === "recurring"
                                      ? "Sin clientes recurrentes"
                                      : "Sin oportunidades en esta etapa"}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}
                  {!filtered.length && leads.length > 0 && (
                    <div className="board-no-results" role="status">
                      No hay oportunidades con esos filtros.
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setSource("");
                        }}
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              ) : view === "pipeline" ? (
                <section
                  className="lost-opportunities"
                  aria-label="Oportunidades perdidas"
                >
                  {lost.length ? (
                    <div className="lost-cards">
                      {lost.map((lead) => (
                        <div key={lead.id}>
                          <LeadCard
                            lead={lead}
                            clock={clock}
                            labels={settings.stageLabels}
                            moving={Boolean(movingId)}
                            onMove={(stage) => void moveLead(lead, stage)}
                            onSource={(source) =>
                              void changeSource(lead, source)
                            }
                            onClick={() => setSelected(lead.id)}
                          />
                          <p className="lost-reason">
                            {lead.lostReason ||
                              "Motivo de pérdida sin registrar"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<Users size={26} />}
                      title="Sin oportunidades perdidas"
                      text="Los contactos que cierres como perdidos conservan aquí sus datos y su historial."
                    />
                  )}
                </section>
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
                              <SourceLabel source={l.source || "Sin canal"} />
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
                      title="Todavía no hay contactos"
                      text="Registra un contacto para gestionar su información y programar el próximo paso."
                    />
                  )}
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <CircleHelp size={15} /> Gestión manual · Meta pendiente de
              conexión
            </span>
            <span>Almojábanas Huilenses · CRM</span>
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
          onReviewed={(id) =>
            setAttention((before) => ({
              ...before,
              unreviewedIds: before.unreviewedIds.filter((item) => item !== id),
            }))
          }
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
  onSource,
}: {
  lead: Lead;
  clock: number;
  labels: Record<Stage, string>;
  moving: boolean;
  onMove: (stage: Stage) => void;
  onSource: (source: string) => void;
  onClick: () => void;
}) {
  const late =
    canFollowUp(lead.stage) &&
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
      <button
        className="lead-card-open"
        data-lead-open={lead.id}
        onClick={onClick}
        aria-label={`Ver detalle de ${lead.name}`}
      >
        <div className="card-identity">
          <span className="lead-initials" aria-hidden="true">
            {initials(lead.name)}
          </span>
          <div className="card-summary">
            <h4 title={lead.name}>{lead.name}</h4>
            <div className="card-channel">
              {lead.source && <SourceLabel source={lead.source} />}
              {lead.phone && <span title={lead.phone}>{lead.phone}</span>}
            </div>
          </div>
          <ArrowUpRight size={15} />
        </div>
        {lead.nextContactAt && canFollowUp(lead.stage) && (
          <div
            className={`card-followup ${late ? "late" : ""}`}
            title={dateLabel(lead.nextContactAt)}
          >
            <Clock3 size={13} />
            {late ? "Vencido · " : "Próximo · "}
            {new Intl.DateTimeFormat("es-CO", {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(lead.nextContactAt))}
          </div>
        )}
        {lead.value > 0 && (
          <span className="card-amount" title="Valor estimado">
            Valor est. {currency(lead.value)}
          </span>
        )}
      </button>
      {!lead.source.trim() && (
        <select
          className="missing-source"
          aria-label={`Canal de origen de ${lead.name}`}
          value=""
          disabled={moving}
          onChange={(event) => onSource(event.target.value)}
        >
          <option value="" disabled>
            Asignar canal
          </option>
          <option>WhatsApp</option>
          <option>Instagram</option>
          <option>Facebook</option>
          <option>Referido</option>
          <option>Otro</option>
        </select>
      )}
      <div className="card-footer">
        {lead.owner && (
          <span className="card-owner" title={lead.owner}>
            <Users size={13} />
            <span>{lead.owner}</span>
          </span>
        )}
        <label className="quick-stage">
          <span className="sr-only">Etapa</span>
          <select
            aria-label={`Etapa de ${lead.name}`}
            data-stage-lead={lead.id}
            title={labels[lead.stage]}
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
      </div>
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
          'a[href], button, input, select, textarea, [tabindex="0"]',
        ) || [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
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
      // React may still be clearing the background's inert state during cleanup.
      requestAnimationFrame(() => {
        if (previous?.isConnected && !previous.closest("[inert]")) {
          previous.focus();
        } else {
          const menu = document.querySelector<HTMLButtonElement>(
            '[aria-label="Abrir menú"]',
          );
          (menu?.getClientRects().length
            ? menu
            : document.getElementById("main-content")
          )?.focus();
        }
      });
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
      <p className="form-hint stage-hint">{stageHints[input.stage]}</p>
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
      subtitle="Ocho etapas comerciales y un cierre separado para oportunidades perdidas."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="settings-fields">
          {stages.map((stage, i) => (
            <Field
              label={
                stage === "lost"
                  ? "Cierre: oportunidad perdida"
                  : `${i + 1}. ${defaultLabels[stage]}`
              }
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
          Primera compra y cliente recurrente cuentan como conversiones, sin
          duplicar al mismo lead. Las oportunidades perdidas quedan fuera de las
          ocho columnas. Una espera se gestiona con fecha de seguimiento,
          conservando su etapa.
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
  onReviewed,
}: {
  id: string;
  labels: Record<Stage, string>;
  onClose: () => void;
  onChange: () => Promise<void>;
  onReviewed: (id: string) => void;
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
  const [tab, setTab] = useState<"info" | "activity" | "conversation">("info");
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
    void (async () => {
      await refresh();
      await api(`/leads/${id}/review`, { method: "POST" });
      onReviewed(id);
    })().catch((e) => setError(e.message));
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
  const tabs = [
    { id: "info", label: "Información" },
    { id: "activity", label: "Actividad" },
    { id: "conversation", label: "Conversación" },
  ] as const;
  return (
    <Modal
      title={detail?.lead.name || "Oportunidad"}
      subtitle="Ficha de la oportunidad"
      onClose={onClose}
      wide
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {detail ? (
        <>
          <div className="detail-contact">
            <span className="detail-avatar">{initials(detail.lead.name)}</span>
            <div>
              <span className={`stage-pill stage-${detail.lead.stage}`}>
                {labels[detail.lead.stage]}
              </span>
              <p>
                {detail.lead.phone ||
                  detail.lead.email ||
                  "Sin datos de contacto"}
              </p>
              <small>Creado el {dateLabel(detail.lead.createdAt)}</small>
            </div>
          </div>
          <div className="manual-whatsapp">
            {whatsappContactUrl(detail.lead.phone) ? (
              <a
                className="secondary whatsapp-action"
                href={whatsappContactUrl(detail.lead.phone)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare size={17} /> Abrir conversación en WhatsApp{" "}
                <ArrowUpRight size={15} />
              </a>
            ) : (
              <p>
                Añade un teléfono con indicativo internacional para abrir
                WhatsApp.
              </p>
            )}
            <p>
              Responde desde WhatsApp y registra aquí el resultado de la
              conversación.
            </p>
          </div>
          <div
            className="detail-tabs"
            role="tablist"
            aria-label="Ficha del lead"
          >
            {tabs.map((item, index) => (
              <button
                key={item.id}
                id={`detail-tab-${item.id}`}
                role="tab"
                aria-selected={tab === item.id}
                aria-controls="detail-panel"
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => {
                  let next = index;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % tabs.length;
                  else if (event.key === "ArrowLeft")
                    next = (index + tabs.length - 1) % tabs.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  setTab(tabs[next].id);
                  document
                    .getElementById(`detail-tab-${tabs[next].id}`)
                    ?.focus();
                }}
              >
                {item.label}
                {item.id === "activity" && (
                  <span aria-hidden="true">{detail.activities.length}</span>
                )}
              </button>
            ))}
          </div>
          <section
            id="detail-panel"
            role="tabpanel"
            aria-labelledby={`detail-tab-${tab}`}
            className="detail-panel"
          >
            {tab === "info" ? (
              <form onSubmit={save}>
                <div className="form-section-title">
                  <Users size={18} />
                  <h3>Datos del contacto y la oportunidad</h3>
                </div>
                <LeadFields input={draft} setInput={setDraft} labels={labels} />
                <div className="form-actions">
                  <span>Guarda los cambios antes de cerrar.</span>
                  <button className="primary" disabled={busy}>
                    {busy ? "Guardando…" : "Guardar cambios"}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            ) : tab === "activity" ? (
              <section className="activity-section">
                {conversation?.session && (
                  <div className="buyer-summary">
                    <strong>
                      {conversation.session.state === "opted_out"
                        ? "Seguimiento automático detenido"
                        : ["human", "ready"].includes(
                              conversation.session.state,
                            )
                          ? "Atención del equipo pendiente"
                          : "Solicitud en curso"}
                    </strong>
                    {conversation.session.profile.segment && (
                      <p>
                        Tipo de comprador:{" "}
                        {conversation.session.profile.segment}
                      </p>
                    )}
                    {conversation.session.profile.quantity && (
                      <p>
                        Unidades de interés:{" "}
                        {conversation.session.profile.quantity}
                      </p>
                    )}
                    {conversation.session.profile.city && (
                      <p>Ciudad: {conversation.session.profile.city}</p>
                    )}
                    {conversation.session.profile.sampleRequested !==
                      undefined && (
                      <p>
                        Muestra:{" "}
                        {conversation.session.profile.sampleRequested
                          ? "Solicitada, pendiente de aprobación"
                          : "No solicitada"}
                      </p>
                    )}
                  </div>
                )}
                <div className="form-section-title">
                  <MessageSquare size={18} />
                  <h3>Registrar una nota</h3>
                </div>
                <p className="form-hint">
                  Solo la ve tu equipo. No envía un mensaje al cliente.
                </p>
                <form onSubmit={addNote}>
                  <textarea
                    aria-label="Nueva nota"
                    placeholder="Resultado de la conversación y próximo paso…"
                    maxLength={4000}
                    required
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <button className="primary" disabled={busy || !note.trim()}>
                    <Plus size={16} /> Agregar nota
                  </button>
                </form>
                <h3 className="timeline-title">Historial de la oportunidad</h3>
                <div className="timeline">
                  {detail.activities.map((activity) => (
                    <article
                      key={activity.id}
                      className={`activity activity-${activity.kind}`}
                    >
                      <span className="timeline-dot">
                        {activity.kind === "note" ? (
                          <MessageSquare size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                      </span>
                      <small>{dateLabel(activity.createdAt)}</small>
                      <p>{activity.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="meta-conversation">
                {conversation?.messages.length ? (
                  conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message chat-${message.direction === "inbound" ? "user" : "bot"}`}
                    >
                      <small>
                        {message.direction === "inbound"
                          ? "Cliente"
                          : "Asistente"}{" "}
                        ·{" "}
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
                        )[message.state] || message.state}{" "}
                        · {dateLabel(message.createdAt)}
                      </small>
                      <p>{message.body}</p>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={<MessageSquare size={28} />}
                    title="Sin mensajes sincronizados"
                    text="La atención actual se hace en WhatsApp Business. La sincronización de mensajes requiere conectar Meta."
                  />
                )}
              </section>
            )}
          </section>
        </>
      ) : (
        !error && (
          <div className="large-empty">
            <LoaderCircle className="spin" /> Cargando oportunidad…
          </div>
        )
      )}
    </Modal>
  );
}
