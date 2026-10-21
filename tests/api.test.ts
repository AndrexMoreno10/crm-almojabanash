import { DatabaseSync } from "node:sqlite";
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

test("migrates a five-stage database without changing leads, notes or customized labels", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-legacy-"));
  const path = join(directory, "legacy.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    const created = await request(instance.app)
      .post("/api/leads")
      .send({
        name: "Cliente anterior",
        stage: "proposal",
        value: 350000,
        owner: "Equipo",
        nextContactAt: "2026-10-25T15:30:00.000Z",
      })
      .expect(201);
    const id = created.body.id;
    await request(instance.app)
      .post(`/api/leads/${id}/notes`)
      .send({ body: "Nota anterior a la actualización" })
      .expect(201);
    const original = await request(instance.app).get(`/api/leads/${id}`);
    instance.close();
    const oldDb = new DatabaseSync(path);
    oldDb
      .prepare("UPDATE settings SET data=? WHERE id=1")
      .run(
        JSON.stringify({
          stageLabels: {
            new: "Nuevo contacto",
            conversation: "Calificando",
            proposal: "Propuesta enviada",
            won: "Venta ganada",
            lost: "Venta perdida",
          },
        }),
      );
    oldDb.exec("DROP TABLE schema_migrations");
    oldDb.close();
    instance = createApp(path, undefined, {});
    const settings = await request(instance.app)
      .get("/api/settings")
      .expect(200);
    assert.equal(Object.keys(settings.body.stageLabels).length, 9);
    assert.equal(settings.body.stageLabels.conversation, "Calificando");
    assert.equal(settings.body.stageLabels.new, "Nuevo lead");
    assert.equal(
      settings.body.stageLabels.proposal,
      "Información comercial enviada",
    );
    assert.equal(settings.body.stageLabels.won, "Primera compra realizada");
    assert.equal(settings.body.stageLabels.recurring, "Cliente recurrente");
    const migrated = await request(instance.app).get(`/api/leads/${id}`);
    assert.deepEqual(migrated.body, original.body);
    // A later deliberate customization to an old label must remain untouched.
    settings.body.stageLabels.new = "Nuevo contacto";
    await request(instance.app)
      .put("/api/settings")
      .send(settings.body)
      .expect(200);
    instance.close();
    instance = createApp(path, undefined, {});
    const repeated = await request(instance.app).get("/api/settings");
    assert.equal(repeated.body.stageLabels.new, "Nuevo contacto");
    assert.deepEqual(
      (await request(instance.app).get(`/api/leads/${id}`)).body,
      original.body,
    );
  } finally {
    instance.close();
    rmSync(directory, { recursive: true });
  }
});

test("persists all eight stages, lost closure and recovery with a trace of each transition", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const created = await request(app)
    .post("/api/leads")
    .send({ name: "Comprador de prueba", value: 90000 })
    .expect(201);
  const id = created.body.id;
  for (const stage of [
    "conversation",
    "proposal",
    "interested",
    "sample",
    "closing",
    "won",
    "recurring",
    "lost",
    "interested",
  ]) {
    const updated = await request(app)
      .patch(`/api/leads/${id}`)
      .send({ stage })
      .expect(200);
    assert.equal(updated.body.stage, stage);
    assert.equal(updated.body.value, 90000);
  }
  const detail = await request(app).get(`/api/leads/${id}`);
  const events = detail.body.activities.filter((item: { body: string }) =>
    item.body.startsWith("Etapa:"),
  );
  assert.equal(events.length, 9);
  assert.ok(
    events.some(
      (item: { body: string }) =>
        item.body === "Etapa: Primera compra realizada → Cliente recurrente",
    ),
  );
  assert.ok(
    events.some(
      (item: { body: string }) =>
        item.body === "Etapa: Cliente recurrente → Oportunidad perdida",
    ),
  );
});
