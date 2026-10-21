import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  ArrowDownLeft,
  ArrowUpRight,
  Archive,
  Box,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  Package,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import Modal from "./Modal";
import {
  movementLabels,
  movementTypes,
  stockLabels,
  stockStatus,
  quantityLabel,
  type InventoryProduct,
  type ProductInput,
  type MovementType,
  type MovementPage,
} from "../shared/inventory";
import type { Lead } from "../shared/types";
import "./inventory.css";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/inventory${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || "No pudimos completar la operación de inventario",
    );
  return data;
}
const priceLabel = (value: number | null, currency: string) =>
  value === null
    ? "Por definir"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
const blankProduct: ProductInput = {
  name: "",
  presentation: "",
  code: "",
  category: "",
  unit: "",
  retailPrice: null,
  wholesalePrice: null,
  costPrice: null,
  currency: "",
  minimumStock: null,
  notes: "",
  active: true,
};
type Dialog =
  | { type: "product"; product?: InventoryProduct }
  | { type: "movement"; product?: InventoryProduct }
  | { type: "archive"; product: InventoryProduct };

export default function Inventory({
  leads,
  refreshKey,
  onModalChange,
}: {
  leads: Lead[];
  refreshKey: number;
  onModalChange: (open: boolean) => void;
}) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<MovementPage>({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  const [tab, setTab] = useState<"products" | "movements">("products");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [movementProduct, setMovementProduct] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [revision, setRevision] = useState(0);
  const loadRef = useRef(0);
  useEffect(() => {
    onModalChange(Boolean(dialog));
    return () => onModalChange(false);
  }, [dialog, onModalChange]);
  useEffect(() => {
    const controller = new AbortController(),
      version = ++loadRef.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (movementProduct) params.set("productId", movementProduct);
    void Promise.all([
      request<InventoryProduct[]>("/products?includeArchived=1", {
        signal: controller.signal,
      }),
      request<MovementPage>(`/movements?${params}`, {
        signal: controller.signal,
      }),
    ])
      .then(([products, movements]) => {
        if (version !== loadRef.current || controller.signal.aborted) return;
        setProducts(products);
        setMovements(movements);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted && version === loadRef.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey, revision, page, movementProduct]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const closeDialog = useCallback(() => setDialog(null), []);
  const saved = (message: string) => {
    setDialog(null);
    setRevision((before) => before + 1);
    setNotice(message);
  };
  const active = products.filter((product) => product.active);
  const visible = products.filter(
    (product) =>
      product.active !== archived &&
      (!category || product.category === category) &&
      (!status || stockStatus(product) === status) &&
      `${product.name} ${product.presentation} ${product.code}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort();
  function exportProducts() {
    const cell = (value: unknown) => {
      const text = String(value ?? "");
      return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Producto",
        "Presentación",
        "Código",
        "Categoría",
        "Unidad",
        "Existencias",
        "Mínimo",
        "Precio detal",
        "Precio mayorista",
        "Costo",
        "Moneda",
        "Activo",
      ],
      ...visible.map((p) => [
        p.name,
        p.presentation,
        p.code,
        p.category,
        p.unit,
        p.stock ?? "Sin registrar",
        p.minimumStock ?? "",
        p.retailPrice ?? "",
        p.wholesalePrice ?? "",
        p.costPrice ?? "",
        p.currency,
        p.active ? "Sí" : "No",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventario.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="inventory">
      <div className="inventory-heading">
        <p>Productos, precios y existencias del negocio.</p>
        <div>
          <button
            className="secondary"
            onClick={() => setDialog({ type: "movement" })}
            disabled={!active.length || loading || Boolean(error)}
          >
            <ArrowUpRight size={16} />
            Registrar movimiento
          </button>
          <button
            className="primary"
            onClick={() => setDialog({ type: "product" })}
          >
            <Plus size={17} />
            Nuevo producto
          </button>
        </div>
      </div>
      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      <div className="inventory-summary" aria-label="Estado del inventario">
        <span>
          <Package size={17} />
          <strong>{loading || error ? "—" : active.length}</strong> productos
        </span>
        <span className="stock-low">
          <strong>
            {loading || error
              ? "—"
              : active.filter((p) => stockStatus(p) === "low").length}
          </strong>{" "}
          con stock bajo
        </span>
        <span className="stock-empty">
          <strong>
            {loading || error
              ? "—"
              : active.filter((p) => stockStatus(p) === "empty").length}
          </strong>{" "}
          agotados
        </span>
        <span>
          <strong>
            {loading || error
              ? "—"
              : active.filter((p) => p.stock === null).length}
          </strong>{" "}
          sin conteo
        </span>
      </div>
      <section className="inventory-panel" aria-label="Control de inventario">
        <div
          className="inventory-tabs"
          role="tablist"
          aria-label="Vistas del inventario"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "products"
                : event.key === "End"
                  ? "movements"
                  : tab === "products"
                    ? "movements"
                    : "products";
            setTab(next);
            document.getElementById(`inventory-tab-${next}`)?.focus();
          }}
        >
          <button
            role="tab"
            id="inventory-tab-products"
            aria-selected={tab === "products"}
            aria-controls="inventory-products"
            tabIndex={tab === "products" ? 0 : -1}
            onClick={() => setTab("products")}
          >
            <Box size={16} />
            Productos
          </button>
          <button
            role="tab"
            id="inventory-tab-movements"
            aria-selected={tab === "movements"}
            aria-controls="inventory-movements"
            tabIndex={tab === "movements" ? 0 : -1}
            onClick={() => setTab("movements")}
          >
            <History size={16} />
            Movimientos
          </button>
        </div>
        {error ? (
          <div className="inventory-empty" role="alert">
            <h2>No se pudo consultar el inventario</h2>
            <p>{error}</p>
            <button
              className="secondary"
              onClick={() => setRevision((before) => before + 1)}
            >
              Reintentar inventario
            </button>
          </div>
        ) : loading ? (
          <div className="inventory-empty" role="status">
            <LoaderCircle className="spin" />
            <p>Cargando inventario…</p>
          </div>
        ) : tab === "products" ? (
          <div
            id="inventory-products"
            role="tabpanel"
            aria-labelledby="inventory-tab-products"
          >
            <div className="inventory-toolbar">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Buscar producto"
                  placeholder="Buscar producto, presentación o código…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="Categoría del producto"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <select
                aria-label="Estado de existencias"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todas las existencias</option>
                {Object.entries(stockLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="inventory-archive-toggle">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(event) => setArchived(event.target.checked)}
                />
                Archivados
              </label>
              <button
                className="text-button"
                onClick={exportProducts}
                disabled={!visible.length}
              >
                <ArrowDownToLine size={16} />
                Exportar inventario
              </button>
            </div>
            <div
              className="inventory-table"
              role="region"
              aria-label="Productos del inventario"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Existencias</th>
                    <th>Precio detal</th>
                    <th>Precio mayorista</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <button
                          className="inventory-product-name"
                          onClick={() =>
                            setDialog({ type: "product", product })
                          }
                        >
                          {product.name}
                        </button>
                        <small>
                          {[
                            product.presentation,
                            product.category,
                            product.code,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </td>
                      <td>
                        <strong className="inventory-quantity">
                          {product.stock === null
                            ? "Sin registrar"
                            : quantityLabel(product.stock)}{" "}
                          <small>{product.unit}</small>
                        </strong>
                        <span
                          className={`stock-badge stock-${stockStatus(product)}`}
                        >
                          {stockLabels[stockStatus(product)]}
                        </span>
                        {product.minimumStock !== null && (
                          <small>
                            Mínimo: {quantityLabel(product.minimumStock)}{" "}
                            {product.unit}
                          </small>
                        )}
                      </td>
                      <td>
                        {priceLabel(product.retailPrice, product.currency)}
                      </td>
                      <td>
                        {priceLabel(product.wholesalePrice, product.currency)}
                      </td>
                      <td>
                        <div className="inventory-row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Editar ${product.name}${product.presentation ? ` ${product.presentation}` : ""}`}
                            title="Editar producto y precios"
                            onClick={() =>
                              setDialog({ type: "product", product })
                            }
                          >
                            <Settings2 size={17} />
                          </button>
                          {product.active ? (
                            <>
                              <button
                                className="icon-button"
                                aria-label={`Registrar movimiento de ${product.name}${product.presentation ? ` ${product.presentation}` : ""}`}
                                title={
                                  product.stock === null
                                    ? "Registrar conteo inicial"
                                    : "Registrar entrada o salida"
                                }
                                onClick={() =>
                                  setDialog({ type: "movement", product })
                                }
                              >
                                <Plus size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Archivar ${product.name}${product.presentation ? ` ${product.presentation}` : ""}`}
                                title="Archivar producto"
                                onClick={() =>
                                  setDialog({ type: "archive", product })
                                }
                              >
                                <Archive size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() =>
                                setDialog({ type: "archive", product })
                              }
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <div className="inventory-empty">
                <Package size={28} />
                <h2>
                  {products.length
                    ? "No hay productos con estos filtros"
                    : "Empieza por el catálogo del negocio"}
                </h2>
                <p>
                  {products.length
                    ? "Cambia la búsqueda o los filtros para ver otros productos."
                    : "Registra el primer producto y su unidad de control."}
                </p>
              </div>
            )}
            <p className="inventory-footnote">
              {visible.length} productos · Los precios y conteos pendientes
              quedan por definir.
            </p>
          </div>
        ) : (
          <div
            id="inventory-movements"
            role="tabpanel"
            aria-labelledby="inventory-tab-movements"
          >
            <div className="inventory-toolbar">
              <select
                aria-label="Filtrar movimientos por producto"
                value={movementProduct}
                onChange={(event) => {
                  setMovementProduct(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos los productos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.presentation ? ` · ${product.presentation}` : ""}
                    {!product.active ? " (archivado)" : ""}
                  </option>
                ))}
              </select>
              <span>{movements.total} movimientos</span>
            </div>
            {movements.items.length ? (
              <>
                <div
                  className="inventory-table"
                  role="region"
                  aria-label="Historial de movimientos"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha / producto</th>
                        <th>Movimiento</th>
                        <th>Cantidad</th>
                        <th>Saldo</th>
                        <th>Motivo / referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.productName}</strong>
                            {item.presentation && (
                              <small>{item.presentation}</small>
                            )}
                            <small>
                              {new Date(item.createdAt).toLocaleString("es-CO")}
                            </small>
                          </td>
                          <td>
                            <span
                              className={`movement-direction ${item.delta < 0 ? "out" : "in"}`}
                            >
                              {item.delta < 0 ? (
                                <ArrowUpRight size={14} />
                              ) : (
                                <ArrowDownLeft size={14} />
                              )}{" "}
                              {movementLabels[item.type]}
                            </span>
                          </td>
                          <td>
                            {item.delta > 0 ? "+" : item.delta < 0 ? "−" : ""}
                            {quantityLabel(item.quantity)} {item.unit}
                          </td>
                          <td>
                            {quantityLabel(item.balance)} {item.unit}
                          </td>
                          <td>
                            {item.reason}
                            {item.reference && <small>{item.reference}</small>}
                            {item.leadId && (
                              <small>
                                Contacto:{" "}
                                {leads.find((lead) => lead.id === item.leadId)
                                  ?.name || "Registrado en CRM"}
                              </small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="inventory-pagination">
                  <span>
                    Página {page} de{" "}
                    {Math.ceil(movements.total / movements.limit)}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Movimientos anteriores"
                    disabled={page === 1}
                    onClick={() => setPage((before) => before - 1)}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Movimientos siguientes"
                    disabled={page * movements.limit >= movements.total}
                    onClick={() => setPage((before) => before + 1)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </>
            ) : (
              <div className="inventory-empty">
                <History size={28} />
                <h2>Aún no hay movimientos</h2>
                <p>Empieza por el conteo inicial de cada producto.</p>
              </div>
            )}
          </div>
        )}
      </section>
      {dialog &&
        createPortal(
          dialog.type === "product" ? (
            <ProductForm
              product={dialog.product}
              categories={categories}
              onClose={closeDialog}
              onSave={() => saved("Producto guardado")}
            />
          ) : dialog.type === "movement" ? (
            <MovementForm
              product={dialog.product}
              products={active}
              leads={leads}
              onClose={closeDialog}
              onSave={() => saved("Movimiento registrado")}
            />
          ) : (
            <ArchiveProduct
              product={dialog.product}
              onClose={closeDialog}
              onSave={() =>
                saved(
                  dialog.product.active
                    ? "Producto archivado"
                    : "Producto reactivado",
                )
              }
            />
          ),
          document.body,
        )}
    </div>
  );
}

function ProductForm({
  product,
  categories,
  onClose,
  onSave,
}: {
  product?: InventoryProduct;
  categories: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState<ProductInput>(() =>
    product ? { ...product } : blankProduct,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function update<K extends keyof ProductInput>(
    key: K,
    value: ProductInput[K],
  ) {
    setDraft((before) => ({ ...before, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const {
        name,
        presentation,
        code,
        category,
        unit,
        retailPrice,
        wholesalePrice,
        costPrice,
        currency,
        minimumStock,
        notes,
        active,
      } = draft;
      await request(product ? `/products/${product.id}` : "/products", {
        method: product ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          presentation,
          code,
          category,
          unit,
          retailPrice,
          wholesalePrice,
          costPrice,
          currency,
          minimumStock,
          notes,
          active,
        }),
      });
      onSave();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product ? "Editar producto" : "Nuevo producto"}
      subtitle="Catálogo, precios y control de existencias"
      onClose={busy ? () => {} : onClose}
      wide
    >
      <form onSubmit={submit} className="inventory-form">
        <fieldset disabled={busy}>
          <div className="inventory-form-grid">
            <label className="field">
              Nombre del producto
              <input
                required
                maxLength={160}
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label className="field">
              Presentación
              <input
                maxLength={120}
                placeholder="Tamaño, empaque o variedad"
                value={draft.presentation}
                onChange={(event) => update("presentation", event.target.value)}
              />
            </label>
            <label className="field">
              Categoría
              <input
                list="inventory-categories"
                maxLength={80}
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
              />
              <datalist id="inventory-categories">
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </datalist>
            </label>
            <label className="field">
              Código / SKU
              <input
                maxLength={60}
                value={draft.code}
                onChange={(event) => update("code", event.target.value)}
              />
            </label>
            <label className="field">
              Unidad de control
              <input
                maxLength={40}
                list="inventory-units"
                placeholder="Por definir"
                disabled={
                  product?.stock !== null && product?.stock !== undefined
                }
                value={draft.unit}
                onChange={(event) => update("unit", event.target.value)}
              />
            </label>
            <label className="field">
              Existencia mínima
              <input
                type="number"
                min="0"
                step="0.001"
                max="1000000000"
                placeholder="Sin mínimo definido"
                value={draft.minimumStock ?? ""}
                onChange={(event) =>
                  update(
                    "minimumStock",
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="field">
              Moneda
              <select
                aria-label="Moneda"
                value={draft.currency}
                onChange={(event) => update("currency", event.target.value)}
                required={[
                  draft.retailPrice,
                  draft.wholesalePrice,
                  draft.costPrice,
                ].some((value) => value !== null)}
              >
                <option value="">Por definir</option>
                <option value="COP">COP · Peso colombiano</option>
                <option value="USD">USD · Dólar estadounidense</option>
                <option value="EUR">EUR · Euro</option>
              </select>
            </label>
            {(
              [
                ["retailPrice", "Precio al detal"],
                ["wholesalePrice", "Precio mayorista"],
                ["costPrice", "Costo por unidad"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="field">
                {label}
                <input
                  type="number"
                  min="0"
                  max="10000000000"
                  step="0.01"
                  placeholder="Por definir"
                  value={draft[key] ?? ""}
                  onChange={(event) =>
                    update(
                      key,
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </label>
            ))}
            <label className="field inventory-full">
              Notas del producto
              <textarea
                maxLength={2000}
                value={draft.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </label>
          </div>
          <datalist id="inventory-units">
            {[
              "unidad",
              "bolsa",
              "vaso",
              "botella",
              "paquete",
              "kg",
              "litro",
            ].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </datalist>
          <p className="form-hint">
            Los precios corresponden a una unidad de control. Registra las
            cantidades mediante movimientos de inventario.
          </p>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MovementForm({
  product,
  products,
  leads,
  onClose,
  onSave,
}: {
  product?: InventoryProduct;
  products: InventoryProduct[];
  leads: Lead[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [productId, setProductId] = useState(product?.id || "");
  const selected = products.find((item) => item.id === productId);
  const [type, setType] = useState<MovementType>(
    product?.stock === null ? "opening" : "purchase",
  );
  const [quantity, setQuantity] = useState(""),
    [unit, setUnit] = useState(""),
    [reason, setReason] = useState(""),
    [reference, setReference] = useState(""),
    [leadId, setLeadId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = useRef(crypto.randomUUID());
  const effectiveType =
    selected?.stock === null
      ? "opening"
      : type === "opening"
        ? "purchase"
        : type;
  const delta = ["sale", "waste", "adjustment_out"].includes(effectiveType)
    ? -Number(quantity)
    : Number(quantity);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/movements", {
        method: "POST",
        body: JSON.stringify({
          id: id.current,
          productId,
          type: effectiveType,
          quantity: Number(quantity),
          unit: selected?.unit || unit,
          reason,
          reference,
          leadId: leadId || null,
        }),
      });
      onSave();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Registrar movimiento"
      subtitle="Cada entrada y salida conserva su motivo y saldo"
      onClose={busy ? () => {} : onClose}
    >
      <form className="inventory-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="field">
            Producto
            <select
              aria-label="Producto"
              required
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setUnit("");
                setQuantity("");
              }}
            >
              <option value="">Selecciona un producto</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.presentation ? ` · ${item.presentation}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Tipo de movimiento
            <select
              aria-label="Tipo de movimiento"
              value={effectiveType}
              disabled={!selected || selected.stock === null}
              onChange={(event) => setType(event.target.value as MovementType)}
            >
              {(selected?.stock === null
                ? (["opening"] as const)
                : movementTypes.filter((type) => type !== "opening")
              ).map((type) => (
                <option key={type} value={type}>
                  {movementLabels[type]}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="form-hint">
              Existencias actuales:{" "}
              {selected.stock === null
                ? "sin registrar"
                : `${quantityLabel(selected.stock)} ${selected.unit}`}
              .{" "}
              {selected.stock === null
                ? "El primer movimiento registra el conteo real, incluso si es cero."
                : ""}
            </p>
          )}
          {selected && !selected.unit && (
            <label className="field">
              Unidad de control
              <input
                required
                maxLength={40}
                placeholder="Ej.: unidad, bolsa, vaso, botella"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            Cantidad{selected?.unit ? ` (${selected.unit})` : ""}
            <input
              required
              type="number"
              min={effectiveType === "opening" ? 0 : 0.001}
              step="0.001"
              max="1000000000"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="field">
            Motivo del movimiento
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="field">
            Referencia / documento
            <input
              maxLength={160}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          {["sale", "return"].includes(effectiveType) && (
            <label className="field">
              Contacto relacionado
              <select
                aria-label="Contacto relacionado"
                value={leadId}
                onChange={(event) => setLeadId(event.target.value)}
              >
                <option value="">Sin contacto relacionado</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && quantity !== "" && (
            <p
              className={`inventory-balance ${(selected.stock ?? 0) + delta < 0 ? "negative" : ""}`}
            >
              Saldo después del movimiento:{" "}
              <strong>
                {quantityLabel((selected.stock ?? 0) + delta)}{" "}
                {selected.unit || unit}
              </strong>
            </p>
          )}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="primary"
            disabled={busy || !selected || (selected.stock ?? 0) + delta < 0}
          >
            {busy ? "Guardando…" : "Guardar movimiento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ArchiveProduct({
  product,
  onClose,
  onSave,
}: {
  product: InventoryProduct;
  onClose: () => void;
  onSave: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await request(`/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !product.active }),
      });
      onSave();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product.active ? "Archivar producto" : "Reactivar producto"}
      onClose={busy ? () => {} : onClose}
    >
      <p>
        {product.name}
        {product.presentation ? ` · ${product.presentation}` : ""}
      </p>
      <p className="form-hint">
        {product.active
          ? "El producto saldrá del catálogo activo. Su historial de movimientos se conserva. Las existencias deben quedar en cero o sin conteo."
          : "El producto volverá al catálogo activo con su historial y datos registrados."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy
            ? "Guardando…"
            : product.active
              ? "Archivar producto"
              : "Reactivar producto"}
        </button>
      </div>
    </Modal>
  );
}
