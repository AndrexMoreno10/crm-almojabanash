import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Express, Request } from "express";
import { z } from "zod";
import { advanceBot, type BotSession } from "./bot.ts";

export interface MetaConfig {
  appSecret?: string;
  verifyToken?: string;
  accessToken?: string;
  phoneNumberId?: string;
  graphVersion?: string;
  sendEnabled?: boolean;
}
export const readMetaConfig = (): MetaConfig => ({
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_VERIFY_TOKEN,
  accessToken: process.env.META_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  graphVersion: process.env.META_GRAPH_VERSION,
  sendEnabled: process.env.META_SEND_ENABLED === "true",
});
interface Incoming {
  id: string;
  sender: string;
  account: string;
  name?: string;
  text: string;
  sentAt: number | null;
}
// WhatsApp messages only. Facebook/Instagram comments and DMs are a separate integration.
function messagesFrom(payload: unknown): Incoming[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as {
    object?: string;
    entry?: {
      changes?: {
        field?: string;
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: { wa_id?: string; profile?: { name?: string } }[];
          messages?: {
            id?: string;
            from?: string;
            type?: string;
            timestamp?: string;
            text?: { body?: string };
          }[];
        };
      }[];
    }[];
  };
  if (data.object !== "whatsapp_business_account" || !Array.isArray(data.entry))
    return [];
  const incoming: Incoming[] = [];
  for (const entry of data.entry)
    for (const change of entry && Array.isArray(entry.changes)
      ? entry.changes
      : []) {
      if (!change) continue;
      const value = change.value;
      if (
        change.field !== "messages" ||
        !value ||
        !Array.isArray(value.messages)
      )
        continue;
      for (const message of value.messages) {
        if (
          !message ||
          message.type !== "text" ||
          typeof message.id !== "string" ||
          typeof message.from !== "string" ||
          typeof message.text?.body !== "string" ||
          typeof value.metadata?.phone_number_id !== "string"
        )
          continue;
        const contact = Array.isArray(value.contacts)
          ? value.contacts.find((c) => c && c.wa_id === message.from)
          : undefined;
        if (message.text.body.length > 4000) continue;
        const timestamp =
          typeof message.timestamp === "string" &&
          /^\d+$/.test(message.timestamp)
            ? Number(message.timestamp) * 1000
            : NaN;
        incoming.push({
          id: message.id,
          sender: message.from,
          account: value.metadata.phone_number_id,
          name: contact?.profile?.name,
          text: message.text.body,
          sentAt: Number.isFinite(timestamp) ? timestamp : null,
        });
      }
    }
  return incoming;
}
export function validSignature(
  raw: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature.slice(7)),
  );
}
export function installMeta(
  app: Express,
  db: DatabaseSync,
  config: MetaConfig,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_contacts (
      account TEXT NOT NULL, sender TEXT NOT NULL, leadId TEXT NOT NULL REFERENCES leads(id),
      PRIMARY KEY(account,sender)
    );
    CREATE TABLE IF NOT EXISTS bot_sessions (
      leadId TEXT PRIMARY KEY REFERENCES leads(id), data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, externalId TEXT UNIQUE, leadId TEXT NOT NULL REFERENCES leads(id),
      account TEXT NOT NULL, recipient TEXT NOT NULL, direction TEXT NOT NULL,
      body TEXT NOT NULL, state TEXT NOT NULL, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS message_lead ON messages(leadId, createdAt);
  `);
  const isConfigured = () =>
    Boolean(
      config.appSecret &&
        config.verifyToken &&
        config.accessToken &&
        config.phoneNumberId &&
        /^v\d+\.\d+$/.test(config.graphVersion || ""),
    );
  app.get("/api/integrations/meta/status", (_req, res) => {
    const requirements = {
      META_APP_SECRET: Boolean(config.appSecret),
      META_VERIFY_TOKEN: Boolean(config.verifyToken),
      META_ACCESS_TOKEN: Boolean(config.accessToken),
      WHATSAPP_PHONE_NUMBER_ID: Boolean(config.phoneNumberId),
      META_GRAPH_VERSION: /^v\d+\.\d+$/.test(config.graphVersion || ""),
    };
    res.json({
      configured: isConfigured(),
      sendingEnabled: Boolean(config.sendEnabled && isConfigured()),
      requirements,
      channels: {
        whatsapp: "prepared_not_live",
        instagram: "pending",
        facebook: "pending",
      },
      pending: (
        db
          .prepare(
            "SELECT count(*) AS count FROM messages WHERE direction='outbound' AND state='draft'",
          )
          .get() as { count: number }
      ).count,
    });
  });
  app.post("/api/bot/simulate", (req, res) => {
    const parsed = z
      .object({
        message: z.string().trim().min(1).max(4000),
        session: z
          .object({
            state: z.enum([
              "consent",
              "segment",
              "quantity",
              "city",
              "name",
              "sample",
              "ready",
              "human",
              "opted_out",
            ]),
            profile: z
              .object({
                segment: z.string().max(160).optional(),
                quantity: z.number().positive().optional(),
                city: z.string().max(160).optional(),
                name: z.string().max(160).optional(),
                sampleRequested: z.boolean().optional(),
              })
              .strict(),
          })
          .nullable(),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Mensaje o sesión inválidos" });
      return;
    }
    res.json(advanceBot(parsed.data.session, parsed.data.message));
  });
  app.get("/api/integrations/meta/webhook", (req, res) => {
    if (!config.verifyToken) {
      res.status(503).json({ error: "Verificación de Meta no configurada" });
      return;
    }
    if (
      req.query["hub.mode"] === "subscribe" &&
      req.query["hub.verify_token"] === config.verifyToken &&
      typeof req.query["hub.challenge"] === "string"
    ) {
      res.type("text/plain").send(req.query["hub.challenge"]);
      return;
    }
    res.status(403).json({ error: "Verificación rechazada" });
  });
  app.post("/api/integrations/meta/webhook", (req, res) => {
    if (!config.appSecret || !config.phoneNumberId) {
      res.status(503).json({ error: "Recepción de Meta no configurada" });
      return;
    }
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (
      !raw ||
      !validSignature(raw, req.get("x-hub-signature-256"), config.appSecret)
    ) {
      res.status(403).json({ error: "Firma inválida" });
      return;
    }
    const incoming = messagesFrom(req.body);
    // Reject other phone-number accounts, even with a valid app signature.
    if (incoming.some((m) => m.account !== config.phoneNumberId)) {
      res.status(403).json({ error: "Cuenta no autorizada" });
      return;
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const message of incoming) {
        if (
          db
            .prepare("SELECT id FROM messages WHERE externalId=?")
            .get(message.id)
        )
          continue;
        const now = new Date().toISOString();
        let contact = db
          .prepare(
            "SELECT leadId FROM channel_contacts WHERE account=? AND sender=?",
          )
          .get(message.account, message.sender) as
          | { leadId: string }
          | undefined;
        if (!contact) {
          const id = randomUUID();
          db.prepare(
            `INSERT INTO leads (id,name,phone,email,source,campaign,owner,stage,value,nextContactAt,lostReason,createdAt,updatedAt)
            VALUES (?,?,?,'','WhatsApp','','','new',0,NULL,'',?,?)`,
          ).run(
            id,
            (message.name || "Contacto de WhatsApp").slice(0, 160),
            message.sender,
            now,
            now,
          );
          db.prepare(
            "INSERT INTO channel_contacts (account,sender,leadId) VALUES (?,?,?)",
          ).run(message.account, message.sender, id);
          contact = { leadId: id };
        }
        db.prepare(
          "INSERT INTO messages (id,externalId,leadId,account,recipient,direction,body,state,createdAt) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          message.id,
          contact.leadId,
          message.account,
          message.sender,
          "inbound",
          message.text,
          "received",
          now,
        );
        const stored = db
          .prepare("SELECT data FROM bot_sessions WHERE leadId=?")
          .get(contact.leadId) as { data: string } | undefined;
        const session = stored ? (JSON.parse(stored.data) as BotSession) : null;
        const result = advanceBot(session, message.text);
        db.prepare(
          "INSERT INTO bot_sessions (leadId,data) VALUES (?,?) ON CONFLICT(leadId) DO UPDATE SET data=excluded.data",
        ).run(
          contact.leadId,
          JSON.stringify({ state: result.state, profile: result.profile }),
        );
        if (result.optedOut)
          db.prepare("UPDATE leads SET nextContactAt=NULL WHERE id=?").run(
            contact.leadId,
          );
        if (result.handoff && !result.optedOut)
          db.prepare(
            "UPDATE leads SET nextContactAt=COALESCE(nextContactAt,?) WHERE id=?",
          ).run(now, contact.leadId);
        if (result.profile.name)
          db.prepare("UPDATE leads SET name=? WHERE id=?").run(
            result.profile.name,
            contact.leadId,
          );
        // Stop queued follow-ups when the person opts out. The opt-out acknowledgement itself remains allowed.
        db.prepare(
          "UPDATE messages SET state='cancelled' WHERE leadId=? AND direction='outbound' AND state='draft'",
        ).run(contact.leadId);
        const sessionReplyAllowed =
          message.sentAt !== null &&
          Date.now() - message.sentAt < 24 * 60 * 60000 &&
          message.sentAt <= Date.now() + 5 * 60000;
        if (result.reply)
          db.prepare(
            "INSERT INTO messages (id,externalId,leadId,account,recipient,direction,body,state,createdAt) VALUES (?,NULL,?,?,?,?,?,?,?)",
          ).run(
            randomUUID(),
            contact.leadId,
            message.account,
            message.sender,
            "outbound",
            result.reply,
            sessionReplyAllowed ? "draft" : "expired",
            now,
          );
        if (result.handoff || result.optedOut) {
          const note = result.optedOut
            ? "La persona pidió detener el seguimiento automático."
            : `Atención del equipo pendiente. Datos compartidos: ${JSON.stringify(result.profile)}`;
          db.prepare(
            "INSERT INTO activities (id,leadId,kind,body,createdAt) VALUES (?,?,?,?,?)",
          ).run(randomUUID(), contact.leadId, "event", note, now);
        }
        db.prepare(
          "UPDATE leads SET updatedAt=?, stage=CASE WHEN stage='new' AND ? NOT IN ('consent','opted_out') THEN 'conversation' ELSE stage END WHERE id=?",
        ).run(now, result.state, contact.leadId);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.json({ received: true });
  });
  app.get("/api/leads/:id/messages", (req, res) => {
    if (!db.prepare("SELECT id FROM leads WHERE id=?").get(req.params.id)) {
      res.status(404).json({ error: "Oportunidad no encontrada" });
      return;
    }
    const session = db
      .prepare("SELECT data FROM bot_sessions WHERE leadId=?")
      .get(req.params.id) as { data: string } | undefined;
    res.json({
      session: session ? JSON.parse(session.data) : null,
      messages: db
        .prepare(
          "SELECT id,direction,body,state,createdAt FROM messages WHERE leadId=? ORDER BY createdAt,rowid",
        )
        .all(req.params.id),
    });
  });
  // Sends only fresh WhatsApp session replies. No scheduled marketing or cold messages.
  // An ambiguous network failure is never automatically retried, avoiding duplicate messages.
  let dispatching = false;
  async function dispatch() {
    if (dispatching || !config.sendEnabled || !isConfigured()) return;
    dispatching = true;
    try {
      const pending = db
        .prepare(
          "SELECT * FROM messages WHERE direction='outbound' AND state='draft' ORDER BY createdAt,rowid",
        )
        .all() as unknown as {
        id: string;
        leadId: string;
        account: string;
        recipient: string;
        body: string;
        createdAt: string;
      }[];
      for (const message of pending) {
        if (Date.now() - Date.parse(message.createdAt) > 5 * 60000) {
          db.prepare("UPDATE messages SET state='expired' WHERE id=?").run(
            message.id,
          );
          continue;
        }
        const changed = db
          .prepare(
            "UPDATE messages SET state='sending' WHERE id=? AND state='draft'",
          )
          .run(message.id);
        if (!changed.changes) continue;
        try {
          const response = await fetch(
            `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(message.account)}/messages`,
            {
              method: "POST",
              signal: AbortSignal.timeout(10000),
              headers: {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: message.recipient,
                type: "text",
                text: { body: message.body },
              }),
            },
          );
          // Never log provider error bodies: they may include sensitive request details.
          db.prepare("UPDATE messages SET state=? WHERE id=?").run(
            response.ok ? "sent" : "failed",
            message.id,
          );
          await response.body?.cancel();
        } catch {
          db.prepare("UPDATE messages SET state='unknown' WHERE id=?").run(
            message.id,
          );
        }
      }
    } finally {
      dispatching = false;
    }
  }
  return { dispatch };
}
