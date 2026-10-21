import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import request from "supertest";
import { createApp } from "../server/app.ts";

test("follow-up colors migrate existing leads, persist and trace independently of stage, notes and review", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-followup-")),
    path = join(directory, "crm.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    const lead = (
      await request(instance.app)
        .post("/api/leads")
        .send({
          name: "Lead existente",
          stage: "interested",
          nextContactAt: "2026-12-01T12:00:00.000Z",
        })
        .expect(201)
    ).body;
    await request(instance.app)
      .post(`/api/leads/${lead.id}/notes`)
      .send({ body: "Nota anterior" })
      .expect(201);
    const before = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body;
    instance.close();
    const old = new DatabaseSync(path);
    old.exec("ALTER TABLE leads DROP COLUMN followupStatus");
    old.close();
    instance = createApp(path, undefined, {});
    assert.deepEqual(
      (await request(instance.app).get(`/api/leads/${lead.id}`)).body,
      before,
    );
    const attention = (await request(instance.app).get("/api/attention")).body;
    for (const followupStatus of ["available", "not_interested", "pending"]) {
      const result = (
        await request(instance.app)
          .patch(`/api/leads/${lead.id}`)
          .send({ followupStatus })
          .expect(200)
      ).body;
      assert.equal(result.stage, "interested");
      assert.equal(result.nextContactAt, lead.nextContactAt);
    }
    await request(instance.app)
      .patch(`/api/leads/${lead.id}`)
      .send({ followupStatus: "unknown" })
      .expect(400);
    instance.close();
    instance = createApp(path, undefined, {});
    const after = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body;
    assert.equal(after.lead.followupStatus, "pending");
    assert.equal(
      after.activities.filter((item: { body: string }) =>
        item.body.startsWith("Seguimiento:"),
      ).length,
      3,
    );
    assert.ok(
      after.activities.some(
        (item: { body: string }) => item.body === "Nota anterior",
      ),
    );
    assert.deepEqual(
      (await request(instance.app).get("/api/attention")).body,
      attention,
    );
  } finally {
    instance.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
