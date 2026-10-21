import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import {
  initialCatalog,
  movementTypes,
  type InventoryProduct,
  type InventoryMovement,
} from "../shared/inventory.ts";

const text = (max: number) => z.string().trim().max(max);
const precise = (places: number, max: number) =>
  z
    .number()
    .finite()
    .min(0)
    .max(max)
    .refine(
      (value) =>
        Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) <
        1e-6,
      `Usa como máximo ${places} decimales`,
    );
const quantity = precise(3, 1e9);
const money = precise(2, 1e10).nullable();
const productSchema = z
  .object({
    name: text(160).min(1),
    presentation: text(120).default(""),
    code: text(60).default(""),
    category: text(80).default(""),
    unit: text(40).default(""),
    retailPrice: money.default(null),
    wholesalePrice: money.default(null),
    costPrice: money.default(null),
    currency: z
      .union([z.literal(""), z.string().regex(/^[A-Z]{3}$/)])
      .default(""),
    minimumStock: quantity.nullable().default(null),
    notes: text(2000).default(""),
    active: z.boolean().default(true),
  })
  .strict();
const movementSchema = z
  .object({
    id: z.uuid(),
    productId: z.uuid(),
    type: z.enum(movementTypes),
    quantity,
    unit: text(40).default(""),
    reason: text(1000).min(3),
    reference: text(160).default(""),
    leadId: z.uuid().nullable().default(null),
  })
  .strict();
type Row = Record<string, string | number | null>;
const asProduct = (row: Row): InventoryProduct => ({
  id: String(row.id),
  name: String(row.name),
  presentation: String(row.presentation),
  code: String(row.code),
  category: String(row.category),
  unit: String(row.unit),
  currency: String(row.currency),
  notes: String(row.notes),
  retailPrice: row.retailMinor === null ? null : Number(row.retailMinor) / 100,
  wholesalePrice:
    row.wholesaleMinor === null ? null : Number(row.wholesaleMinor) / 100,
  costPrice: row.costMinor === null ? null : Number(row.costMinor) / 100,
  minimumStock:
    row.minimumMilli === null ? null : Number(row.minimumMilli) / 1000,
  stock: row.stockMilli === null ? null : Number(row.stockMilli) / 1000,
  active: row.active === 1,
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});
const asMovement = (row: Row): InventoryMovement => ({
  id: String(row.id),
  productId: String(row.productId),
  productName: String(row.productName),
  presentation: String(row.presentation),
  type: row.type as InventoryMovement["type"],
  quantity: Number(row.quantityMilli) / 1000,
  delta: Number(row.deltaMilli) / 1000,
  balance: Number(row.balanceMilli) / 1000,
  unit: String(row.unit),
  reason: String(row.reason),
  reference: String(row.reference),
  leadId: row.leadId === null ? null : String(row.leadId),
  createdAt: String(row.createdAt),
});
class InventoryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const scaled = (value: number | null, factor: number) =>
  value === null ? null : Math.round(value * factor);

export function installInventory(app: Express, db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, presentation TEXT NOT NULL, code TEXT NOT NULL, category TEXT NOT NULL,
      unit TEXT NOT NULL, retailMinor INTEGER, wholesaleMinor INTEGER, costMinor INTEGER, currency TEXT NOT NULL,
      minimumMilli INTEGER CHECK(minimumMilli >= 0), stockMilli INTEGER CHECK(stockMilli >= 0 AND stockMilli <= 1000000000000),
      notes TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_code ON inventory_products(code COLLATE NOCASE) WHERE code <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS inventory_name ON inventory_products(name COLLATE NOCASE, presentation COLLATE NOCASE) WHERE active=1;
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES inventory_products(id), type TEXT NOT NULL,
      quantityMilli INTEGER NOT NULL CHECK(quantityMilli >= 0), deltaMilli INTEGER NOT NULL, balanceMilli INTEGER NOT NULL CHECK(balanceMilli >= 0),
      unit TEXT NOT NULL, reason TEXT NOT NULL, reference TEXT NOT NULL, leadId TEXT REFERENCES leads(id),
      fingerprint TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS inventory_movement_product ON inventory_movements(productId, createdAt);
    CREATE TABLE IF NOT EXISTS inventory_migrations (id TEXT PRIMARY KEY);
  `);
  function transaction<T>(operation: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  transaction(() => {
    if (
      db
        .prepare(
          "SELECT id FROM inventory_migrations WHERE id='user-catalog-2026-10-21'",
        )
        .get()
    )
      return;
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO inventory_products VALUES(?,?,?,'',?,'',NULL,NULL,NULL,'',NULL,NULL,'',1,?,?)`,
    );
    for (const [category, names] of Object.entries(initialCatalog))
      for (const name of names)
        insert.run(randomUUID(), name, "", category, now, now);
    db.prepare(
      "INSERT INTO inventory_migrations VALUES('user-catalog-2026-10-21')",
    ).run();
  });
  const router = express.Router();
  const getRow = (id: string) =>
    db.prepare("SELECT * FROM inventory_products WHERE id=?").get(id) as
      Row | undefined;
  const movementSelect = `SELECT m.*,p.name AS productName,p.presentation FROM inventory_movements m JOIN inventory_products p ON p.id=m.productId`;
  const getMovement = (id: string) =>
    asMovement(db.prepare(`${movementSelect} WHERE m.id=?`).get(id) as Row);
  const validatePrices = (product: z.infer<typeof productSchema>) => {
    if (
      !product.currency &&
      [product.retailPrice, product.wholesalePrice, product.costPrice].some(
        (value) => value !== null,
      )
    )
      throw new InventoryError(
        400,
        "Indica la moneda antes de guardar precios",
      );
  };
  router.get("/products", (req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM inventory_products ${req.query.includeArchived === "1" ? "" : "WHERE active=1"} ORDER BY CASE category WHEN 'Comestibles' THEN 0 WHEN 'Bebidas' THEN 1 ELSE 2 END,category COLLATE NOCASE,name COLLATE NOCASE,presentation`,
      )
      .all() as Row[];
    res.json(rows.map(asProduct));
  });
  router.post("/products", (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Revisa los datos del producto",
        details: parsed.error.flatten(),
      });
      return;
    }
    const p = parsed.data;
    validatePrices(p);
    const id = randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      `INSERT INTO inventory_products VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,?)`,
    ).run(
      id,
      p.name,
      p.presentation,
      p.code,
      p.category,
      p.unit,
      scaled(p.retailPrice, 100),
      scaled(p.wholesalePrice, 100),
      scaled(p.costPrice, 100),
      p.currency,
      scaled(p.minimumStock, 1000),
      p.notes,
      p.active ? 1 : 0,
      now,
      now,
    );
    res.status(201).json(asProduct(getRow(id)!));
  });
  router.patch("/products/:id", (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Revisa los datos del producto" });
      return;
    }
    const product = transaction(() => {
      const row = getRow(req.params.id);
      if (!row) throw new InventoryError(404, "Producto no encontrado");
      const before = asProduct(row);
      const changes = Object.fromEntries(
        Object.entries(parsed.data).filter(([key]) =>
          Object.hasOwn(req.body, key),
        ),
      );
      const p = { ...before, ...changes };
      validatePrices(p);
      if (before.stock !== null && p.unit !== before.unit)
        throw new InventoryError(
          409,
          "La unidad ya tiene movimientos. Crea otra presentación para usar una unidad distinta",
        );
      if (!p.active && before.stock !== null && before.stock !== 0)
        throw new InventoryError(
          409,
          "El producto tiene existencias. Registra su salida o ajuste antes de archivarlo",
        );
      db.prepare(
        `UPDATE inventory_products SET name=?,presentation=?,code=?,category=?,unit=?,retailMinor=?,wholesaleMinor=?,costMinor=?,currency=?,minimumMilli=?,notes=?,active=?,updatedAt=? WHERE id=?`,
      ).run(
        p.name,
        p.presentation,
        p.code,
        p.category,
        p.unit,
        scaled(p.retailPrice, 100),
        scaled(p.wholesalePrice, 100),
        scaled(p.costPrice, 100),
        p.currency,
        scaled(p.minimumStock, 1000),
        p.notes,
        p.active ? 1 : 0,
        new Date().toISOString(),
        p.id,
      );
      return asProduct(getRow(p.id)!);
    });
    res.json(product);
  });
  router.get("/movements", (req, res) => {
    const parsed = z
      .object({
        productId: z.uuid().optional(),
        page: z.coerce.number().int().min(1).max(1e6).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      })
      .strict()
      .safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Revisa el filtro de movimientos" });
      return;
    }
    const { productId, page, limit } = parsed.data;
    const condition = productId ? "WHERE m.productId=?" : "";
    const params = productId ? [productId] : [];
    const total = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM inventory_movements m ${condition}`)
        .get(...params) as { n: number }
    ).n;
    const rows = db
      .prepare(
        `${movementSelect} ${condition} ORDER BY m.rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, (page - 1) * limit) as Row[];
    res.json({ items: rows.map(asMovement), total, page, limit });
  });
  router.post("/movements", (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Revisa el producto, la cantidad y el motivo del movimiento",
        details: parsed.error.flatten(),
      });
      return;
    }
    const input = parsed.data;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const result = transaction(() => {
      const previous = db
        .prepare("SELECT fingerprint FROM inventory_movements WHERE id=?")
        .get(input.id) as { fingerprint: string } | undefined;
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new InventoryError(
            409,
            "Ese identificador ya corresponde a otro movimiento",
          );
        return { movement: getMovement(input.id), repeated: true };
      }
      const row = getRow(input.productId);
      if (!row) throw new InventoryError(404, "Producto no encontrado");
      const product = asProduct(row);
      if (!product.active)
        throw new InventoryError(
          409,
          "Reactiva el producto antes de registrar movimientos",
        );
      if (
        input.type === "opening"
          ? row.stockMilli !== null
          : row.stockMilli === null
      )
        throw new InventoryError(
          409,
          input.type === "opening"
            ? "El conteo inicial ya está registrado. Usa un ajuste para corregir existencias"
            : "Registra primero el conteo inicial, incluso si es cero",
        );
      if (input.type !== "opening" && input.quantity === 0)
        throw new InventoryError(400, "La cantidad debe ser mayor que cero");
      const unit = product.unit || input.unit;
      if (!unit)
        throw new InventoryError(
          400,
          "Define la unidad de control antes de registrar existencias",
        );
      if (input.unit && input.unit !== unit)
        throw new InventoryError(
          409,
          "La unidad no coincide con la del producto",
        );
      if (
        input.leadId &&
        !db.prepare("SELECT id FROM leads WHERE id=?").get(input.leadId)
      )
        throw new InventoryError(400, "El contacto seleccionado no existe");
      const amount = Math.round(input.quantity * 1000);
      const delta = ["sale", "waste", "adjustment_out"].includes(input.type)
        ? -amount
        : amount;
      const balance = Number(row.stockMilli || 0) + delta;
      if (balance < 0)
        throw new InventoryError(
          409,
          "No hay existencias suficientes para registrar esa salida",
        );
      if (balance > 1e12)
        throw new InventoryError(
          400,
          "La cantidad supera el límite de existencias",
        );
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO inventory_movements VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        input.id,
        input.productId,
        input.type,
        amount,
        delta,
        balance,
        unit,
        input.reason,
        input.reference,
        input.leadId,
        fingerprint,
        now,
      );
      db.prepare(
        "UPDATE inventory_products SET stockMilli=?,unit=?,updatedAt=? WHERE id=?",
      ).run(balance, unit, now, input.productId);
      return { movement: getMovement(input.id), repeated: false };
    });
    res.status(result.repeated ? 200 : 201).json(result.movement);
  });
  router.use(
    (
      error: Error & { code?: string },
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (error instanceof InventoryError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (
        error.code?.startsWith("ERR_SQLITE") &&
        error.message.includes("UNIQUE constraint")
      ) {
        res.status(409).json({
          error:
            "Ya existe un producto con ese código o con el mismo nombre y presentación",
        });
        return;
      }
      next(error);
    },
  );
  app.use("/api/inventory", router);
}
