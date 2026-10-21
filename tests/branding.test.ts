import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { createApp } from "../server/app.ts";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("brand upload preserves original image bytes and existing leads across restarts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-brand-"));
  const path = join(directory, "brand.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    assert.deepEqual(
      (await request(instance.app).get("/api/branding").expect(200)).body,
      { logoUrl: null },
    );
    await request(instance.app).get("/api/branding/logo").expect(404);
    const lead = (
      await request(instance.app)
        .post("/api/leads")
        .send({ name: "Contacto existente", source: "" })
        .expect(201)
    ).body;
    await request(instance.app)
      .post(`/api/leads/${lead.id}/notes`)
      .send({ body: "Nota conservada" })
      .expect(201);
    const before = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body;
    const upload = await request(instance.app)
      .put("/api/branding/logo")
      .set("Content-Type", "image/png")
      .send(png)
      .expect(200);
    assert.match(
      upload.body.logoUrl,
      /^\/api\/branding\/logo\?v=[a-f0-9]{16}$/,
    );
    const image = await request(instance.app)
      .get(upload.body.logoUrl)
      .expect(200)
      .expect("Content-Type", /image\/png/);
    assert.deepEqual(image.body, png);
    instance.close();
    instance = createApp(path, undefined, {});
    assert.deepEqual(
      (await request(instance.app).get("/api/branding")).body,
      upload.body,
    );
    assert.deepEqual(
      (await request(instance.app).get(upload.body.logoUrl)).body,
      png,
    );
    assert.deepEqual(
      (await request(instance.app).get(`/api/leads/${lead.id}`)).body,
      before,
    );
    await request(instance.app)
      .patch(`/api/leads/${lead.id}`)
      .send({ source: "WhatsApp" })
      .expect(200);
    const after = (await request(instance.app).get(`/api/leads/${lead.id}`))
      .body;
    assert.equal(after.lead.source, "WhatsApp");
    assert.equal(after.lead.stage, before.lead.stage);
    assert.ok(
      after.activities.some(
        (item: { body: string }) => item.body === "Nota conservada",
      ),
    );
  } finally {
    instance.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("brand upload rejects foreign origins, oversized files, SVG and mismatched image types", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const initial = (
    await request(app)
      .put("/api/branding/logo")
      .set("Content-Type", "image/png")
      .send(png)
      .expect(200)
  ).body;
  await request(app)
    .put("/api/branding/logo")
    .set("Origin", "https://other.example")
    .set("Content-Type", "image/png")
    .send(png)
    .expect(403);
  await request(app)
    .put("/api/branding/logo")
    .set("Content-Type", "image/png")
    .send(Buffer.alloc(2 * 1024 * 1024 + 1))
    .expect(413);
  await request(app)
    .put("/api/branding/logo")
    .set("Content-Type", "image/svg+xml")
    .send("<svg/>")
    .expect(400);
  await request(app)
    .put("/api/branding/logo")
    .set("Content-Type", "image/png")
    .send(Buffer.from("<svg/>"))
    .expect(400);
  await request(app)
    .put("/api/branding/logo")
    .set("Content-Type", "image/jpeg")
    .send(png)
    .expect(400);
  await request(app)
    .put("/api/branding/logo")
    .set("Content-Type", "image/png")
    .send(png.subarray(0, 24))
    .expect(400);
  assert.deepEqual((await request(app).get("/api/branding")).body, initial);
  assert.deepEqual((await request(app).get(initial.logoUrl)).body, png);
});
