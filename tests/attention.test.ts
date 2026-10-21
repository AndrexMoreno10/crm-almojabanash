import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../server/app.ts";
import { matchesAttention } from "../shared/attention.ts";

test("CRM reviews persist without marking a lead answered, changing its commercial history or modifying existing data", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-reviews-"));
  const path = join(directory, "reviews.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    const lead = (
      await request(instance.app)
        .post("/api/leads")
        .send({ name: "Contacto pendiente" })
        .expect(201)
    ).body;
    const recurring = (
      await request(instance.app)
        .post("/api/leads")
        .send({ name: "Cliente recurrente", stage: "recurring" })
        .expect(201)
    ).body;
    await request(instance.app)
      .post("/api/leads")
      .send({ name: "Oportunidad perdida", stage: "lost" })
      .expect(201);
    let attention = (
      await request(instance.app).get("/api/attention").expect(200)
    ).body;
    assert.deepEqual(
      new Set(attention.unreviewedIds),
      new Set([lead.id, recurring.id]),
    );
    await request(instance.app).get(`/api/leads/${lead.id}`).expect(200);
    assert.deepEqual(
      (await request(instance.app).get("/api/attention")).body,
      attention,
      "Fetching data alone does not mark it reviewed",
    );
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .set("Origin", "https://other.example")
      .expect(403);
    await request(instance.app).post("/api/leads/missing/review").expect(404);
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .expect(200);
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .expect(200);
    instance.close();
    instance = createApp(path, undefined, {});
    attention = (await request(instance.app).get("/api/attention")).body;
    assert.deepEqual(attention.unreviewedIds, [recurring.id]);
    const detail = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body;
    assert.deepEqual(detail.lead, lead);
    assert.equal(detail.activities.length, 1);
    assert.equal(
      matchesAttention(lead, "new", new Set()),
      true,
      "Reviewing is independent from first attention",
    );
    assert.equal(
      matchesAttention(recurring, "unscheduled", new Set()),
      false,
      "Sales quality reminders only include open opportunities",
    );
    await request(instance.app)
      .patch(`/api/leads/${lead.id}`)
      .send({ stage: "conversation" })
      .expect(200);
    const updated = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body.lead;
    assert.equal(matchesAttention(updated, "new", new Set()), false);
  } finally {
    instance.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a new incoming message reopens the CRM review even with an identical timestamp; drafts are not new incoming messages", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-review-message-"));
  const path = join(directory, "reviews.sqlite");
  const instance = createApp(path, undefined, {});
  const db = new DatabaseSync(path);
  try {
    const lead = (
      await request(instance.app)
        .post("/api/leads")
        .send({ name: "Conversación de prueba" })
        .expect(201)
    ).body;
    const unread = async () =>
      (await request(instance.app).get("/api/attention").expect(200)).body
        .unreviewedIds;
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .expect(200);
    assert.deepEqual(await unread(), []);
    const insert = db.prepare(
      `INSERT INTO messages (id,externalId,leadId,account,recipient,direction,body,state,createdAt) VALUES (?,NULL,?,'fixture','fixture',?,'Texto de prueba',?,'2026-10-21T00:00:00.000Z')`,
    );
    insert.run("message-1", lead.id, "inbound", "received");
    assert.deepEqual(await unread(), [lead.id]);
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .expect(200);
    insert.run("draft-1", lead.id, "outbound", "draft");
    assert.deepEqual(await unread(), []);
    insert.run("message-2", lead.id, "inbound", "received");
    assert.deepEqual(await unread(), [lead.id]);
    await request(instance.app)
      .post(`/api/leads/${lead.id}/review`)
      .expect(200);
    assert.deepEqual(await unread(), []);
  } finally {
    db.close();
    instance.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
