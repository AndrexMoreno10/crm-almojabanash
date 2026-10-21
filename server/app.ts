import { migratePipelineSettings } from "./migrations.ts";
import { installBranding } from "./branding.ts";
import { installInventory } from "./inventory.ts";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { installMeta, readMetaConfig, type MetaConfig } from "./meta.ts";
import {
  defaultLabels,
  stages,
  followupStates,
  followupLabels,
  type Lead,
  type Settings,
} from "../shared/types.ts";

const text = (max: number) => z.string().trim().max(max);
const leadSchema = z
  .object({
    name: text(160).min(1, "Escribe un nombre"),
    phone: text(40).default(""),
    email: z.union([z.literal(""), z.email()]).default(""),
    source: text(100).default(""),
    campaign: text(160).default(""),
    owner: text(100).default(""),
    stage: z.enum(stages).default("new"),
    value: z.number().finite().min(0).max(1e12).default(0),
    nextContactAt: z.iso.datetime({ offset: true }).nullable().default(null),
    lostReason: text(1000).default(""),
    followupStatus: z.enum(followupStates).default(""),
  })
  .strict();
const labelsSchema = z
  .object({
    stageLabels: z
      .object({
        new: text(50).min(1),
        conversation: text(50).min(1),
        proposal: text(50).min(1),
        interested: text(50).min(1),
        sample: text(50).min(1),
        closing: text(50).min(1),
        recurring: text(50).min(1),
        won: text(50).min(1),
        lost: text(50).min(1),
      })
      .strict(),
  })
  .strict();

export function createApp(
  databasePath: string,
  webDirectory?: string,
  metaConfig: MetaConfig = readMetaConfig(),
) {
  if (databasePath !== ":memory:")
    mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
      source TEXT NOT NULL, campaign TEXT NOT NULL, owner TEXT NOT NULL, stage TEXT NOT NULL,
      value REAL NOT NULL, nextContactAt TEXT, lostReason TEXT NOT NULL,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY, leadId TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activities_lead ON activities(leadId, createdAt);
    CREATE TABLE IF NOT EXISTS lead_reviews (
      leadId TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      reviewedAt TEXT NOT NULL, lastInboundId TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
  `);
  if (
    !(db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).some(
      (column) => column.name === "followupStatus",
    )
  ) {
    db.exec(
      "ALTER TABLE leads ADD COLUMN followupStatus TEXT NOT NULL DEFAULT '' CHECK(followupStatus IN ('','available','pending','not_interested'))",
    );
  }
  db.prepare("INSERT OR IGNORE INTO settings (id, data) VALUES (1, ?)").run(
    JSON.stringify({ stageLabels: defaultLabels }),
  );
  migratePipelineSettings(db);
  const getSettings = () =>
    JSON.parse(
      (
        db.prepare("SELECT data FROM settings WHERE id=1").get() as {
          data: string;
        }
      ).data,
    ) as Settings;
  const getLead = (id: string) =>
    db.prepare("SELECT * FROM leads WHERE id=?").get(id) as unknown as
      Lead | undefined;
  const activity = (leadId: string, kind: string, body: string) =>
    db
      .prepare(
        "INSERT INTO activities (id, leadId, kind, body, createdAt) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), leadId, kind, body, new Date().toISOString());
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
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    next();
  });
  // Prevent browser cross-origin writes to the local, single-user development server.
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.get("origin");
    const allowed = new Set([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    ]);
    const host = req.get("host") || "";
    if (/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
      allowed.add(`http://${host}`);
    if (origin && !allowed.has(origin)) {
      res.status(403).json({ error: "Origen no permitido" });
      return;
    }
    if (req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Solicitud no permitida" });
      return;
    }
    next();
  });
  app.use(
    express.json({
      limit: "64kb",
      verify: (req, _res, buffer) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buffer;
      },
    }),
  );
  const meta = installMeta(app, db, metaConfig);
  installBranding(app, db);
  installInventory(app, db);
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  app.get("/api/settings", (_req, res) => res.json(getSettings()));
  app.put("/api/settings", (req, res) => {
    const result = labelsSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Cada etapa necesita un nombre de hasta 50 caracteres",
      });
      return;
    }
    db.prepare("UPDATE settings SET data=? WHERE id=1").run(
      JSON.stringify(result.data),
    );
    res.json(result.data);
  });
  app.get("/api/leads", (_req, res) =>
    res.json(
      db.prepare("SELECT * FROM leads ORDER BY updatedAt DESC, id").all(),
    ),
  );
  // Tracks reviews inside this CRM, independently of WhatsApp read receipts or replies.
  app.get("/api/attention", (_req, res) => {
    const rows = db
      .prepare(
        `
      SELECT l.id FROM leads l LEFT JOIN lead_reviews r ON r.leadId=l.id
      WHERE l.stage <> 'lost' AND (
        r.leadId IS NULL OR COALESCE(r.lastInboundId, '') <> COALESCE((
          SELECT m.id FROM messages m WHERE m.leadId=l.id AND m.direction='inbound'
          ORDER BY m.rowid DESC LIMIT 1
        ), '')
      ) ORDER BY l.createdAt, l.id
    `,
      )
      .all() as { id: string }[];
    res.json({ unreviewedIds: rows.map((row) => row.id) });
  });
  app.post("/api/leads/:id/review", (req, res) => {
    const lead = getLead(req.params.id);
    if (!lead) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    const reviewedAt = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO lead_reviews (leadId,reviewedAt,lastInboundId)
      VALUES (?, ?, (SELECT id FROM messages WHERE leadId=? AND direction='inbound' ORDER BY rowid DESC LIMIT 1))
      ON CONFLICT(leadId) DO UPDATE SET reviewedAt=excluded.reviewedAt,lastInboundId=excluded.lastInboundId
    `,
    ).run(lead.id, reviewedAt, lead.id);
    res.json({ leadId: lead.id, reviewedAt });
  });
  app.get("/api/leads/:id", (req, res) => {
    const lead = getLead(req.params.id);
    if (!lead) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    res.json({
      lead,
      activities: db
        .prepare(
          "SELECT * FROM activities WHERE leadId=? ORDER BY createdAt DESC, rowid DESC",
        )
        .all(lead.id),
    });
  });
  app.post("/api/leads", (req, res) => {
    const result = leadSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Revisa los datos de la oportunidad",
        details: result.error.flatten(),
      });
      return;
    }
    const now = new Date().toISOString();
    const lead: Lead = {
      ...result.data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    transaction(() => {
      db.prepare(
        `INSERT INTO leads (id,name,phone,email,source,campaign,owner,stage,value,nextContactAt,lostReason,createdAt,updatedAt,followupStatus)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        lead.id,
        lead.name,
        lead.phone,
        lead.email,
        lead.source,
        lead.campaign,
        lead.owner,
        lead.stage,
        lead.value,
        lead.nextContactAt,
        lead.lostReason,
        now,
        now,
        lead.followupStatus,
      );
      activity(lead.id, "event", "Oportunidad creada");
    });
    res.status(201).json(lead);
  });
  app.patch("/api/leads/:id", (req, res) => {
    const before = getLead(req.params.id);
    if (!before) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    const result = leadSchema.partial().safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Revisa los datos de la oportunidad" });
      return;
    }
    const changes = Object.fromEntries(
      Object.entries(result.data).filter(([key]) =>
        Object.hasOwn(req.body, key),
      ),
    );
    const lead = {
      ...before,
      ...changes,
      updatedAt: new Date().toISOString(),
    } as Lead;
    transaction(() => {
      db.prepare(
        `UPDATE leads SET name=?,phone=?,email=?,source=?,campaign=?,owner=?,stage=?,value=?,nextContactAt=?,lostReason=?,followupStatus=?,updatedAt=? WHERE id=?`,
      ).run(
        lead.name,
        lead.phone,
        lead.email,
        lead.source,
        lead.campaign,
        lead.owner,
        lead.stage,
        lead.value,
        lead.nextContactAt,
        lead.lostReason,
        lead.followupStatus,
        lead.updatedAt,
        lead.id,
      );
      if (before.stage !== lead.stage)
        activity(
          lead.id,
          "event",
          `Etapa: ${getSettings().stageLabels[before.stage]} → ${getSettings().stageLabels[lead.stage]}`,
        );
      if (before.followupStatus !== lead.followupStatus)
        activity(
          lead.id,
          "event",
          `Seguimiento: ${followupLabels[before.followupStatus]} → ${followupLabels[lead.followupStatus]}`,
        );
      if (before.nextContactAt !== lead.nextContactAt)
        activity(
          lead.id,
          "event",
          lead.nextContactAt
            ? `Seguimiento programado: ${lead.nextContactAt}`
            : "Seguimiento completado o retirado",
        );
    });
    res.json(lead);
  });
  app.post("/api/leads/:id/notes", (req, res) => {
    const lead = getLead(req.params.id);
    if (!lead) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    const result = z
      .object({ body: text(4000).min(1) })
      .strict()
      .safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ error: "Escribe una nota de hasta 4.000 caracteres" });
      return;
    }
    transaction(() => {
      activity(lead.id, "note", result.data.body);
      db.prepare("UPDATE leads SET updatedAt=? WHERE id=?").run(
        new Date().toISOString(),
        lead.id,
      );
    });
    res.status(201).json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Ruta no encontrada" }),
  );
  if (webDirectory) {
    app.use(express.static(webDirectory));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(webDirectory, "index.html")),
    );
  }
  app.use(
    (
      error: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error.status === 400 || error.status === 413) {
        res
          .status(error.status)
          .json({ error: "Solicitud inválida o demasiado grande" });
        return;
      }
      console.error("Request failed:", error.message);
      res.status(500).json({ error: "No pudimos completar la operación" });
    },
  );
  return { app, dispatchMessages: meta.dispatch, close: () => db.close() };
}
