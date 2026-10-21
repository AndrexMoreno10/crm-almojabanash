import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../server/app.ts";

test("real sales workflow: create, edit stage, schedule, annotate, reload and persist", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-crm-test-"));
  const path = join(directory, "test.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    await request(instance.app)
      .get("/api/health")
      .expect(200, { status: "ok" });
    const created = await request(instance.app)
      .post("/api/leads")
      .send({
        name: "Hotel de prueba",
        phone: "123456",
        source: "WhatsApp",
        campaign: "Campaña de prueba",
        owner: "Equipo",
        value: 120000,
      })
      .expect(201);
    const id = created.body.id;
    assert.equal(created.body.stage, "new");
    const nextContactAt = "2026-10-25T15:30:00.000Z";
    const patched = await request(instance.app)
      .patch(`/api/leads/${id}`)
      .send({ stage: "conversation", nextContactAt })
      .expect(200);
    assert.equal(patched.body.name, "Hotel de prueba");
    assert.equal(patched.body.phone, "123456");
    assert.equal(patched.body.source, "WhatsApp");
    assert.equal(patched.body.value, 120000);
    await request(instance.app)
      .post(`/api/leads/${id}/notes`)
      .send({
        body: "Solicita información sobre muestras; pendiente de confirmar.",
      })
      .expect(201);
    const detail = await request(instance.app)
      .get(`/api/leads/${id}`)
      .expect(200);
    assert.equal(detail.body.lead.nextContactAt, nextContactAt);
    assert.equal(
      detail.body.activities.filter((a: { kind: string }) => a.kind === "note")
        .length,
      1,
    );
    assert.equal(
      detail.body.activities.filter((a: { kind: string }) => a.kind === "event")
        .length,
      3,
    );
    instance.close();
    instance = createApp(path, undefined, {});
    const list = await request(instance.app).get("/api/leads").expect(200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, id);
    assert.equal(list.body[0].nextContactAt, nextContactAt);
    const won = await request(instance.app)
      .patch(`/api/leads/${id}`)
      .send({ stage: "won", nextContactAt: null })
      .expect(200);
    assert.equal(won.body.value, 120000);
    assert.equal(won.body.stage, "won");
  } finally {
    instance.close();
    rmSync(directory, { recursive: true });
  }
});

test("validation rejects malformed input and protects local writes", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  await request(app).post("/api/leads").send({ name: " " }).expect(400);
  await request(app)
    .post("/api/leads")
    .send({ name: "Test", stage: "invented" })
    .expect(400);
  await request(app)
    .post("/api/leads")
    .send({ name: "Test", value: -1 })
    .expect(400);
  await request(app)
    .post("/api/leads")
    .send({ name: "Test", email: "invalid" })
    .expect(400);
  await request(app)
    .post("/api/leads")
    .send({ name: "Test", nextContactAt: "tomorrow" })
    .expect(400);
  await request(app)
    .post("/api/leads")
    .send({ name: "Test", admin: true })
    .expect(400);
  await request(app)
    .post("/api/leads")
    .set("Origin", "https://unknown.example")
    .send({ name: "Test" })
    .expect(403);
  await request(app)
    .post("/api/leads")
    .set("Content-Type", "application/json")
    .send("{bad json")
    .expect(400);
  await request(app).get("/api/leads/missing").expect(404);
  await request(app).get("/api/leads/missing/messages").expect(404);
  const lead = await request(app)
    .post("/api/leads")
    .send({ name: "Robert'); DROP TABLE leads;--" })
    .expect(201);
  await request(app)
    .patch(`/api/leads/${lead.body.id}`)
    .send({ id: "replace-id" })
    .expect(400);
  await request(app)
    .post(`/api/leads/${lead.body.id}/notes`)
    .send({ body: "  " })
    .expect(400);
  const list = await request(app).get("/api/leads").expect(200);
  assert.equal(list.body.length, 1);
});

test("stage labels are configurable and survive application restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-settings-"));
  const path = join(directory, "test.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    const result = await request(instance.app).get("/api/settings");
    result.body.stageLabels.proposal = "Muestra en evaluación";
    await request(instance.app)
      .put("/api/settings")
      .send(result.body)
      .expect(200);
    await request(instance.app)
      .put("/api/settings")
      .send({ stageLabels: { won: "" } })
      .expect(400);
    instance.close();
    instance = createApp(path, undefined, {});
    const saved = await request(instance.app).get("/api/settings");
    assert.equal(saved.body.stageLabels.proposal, "Muestra en evaluación");
  } finally {
    instance.close();
    rmSync(directory, { recursive: true });
  }
});
