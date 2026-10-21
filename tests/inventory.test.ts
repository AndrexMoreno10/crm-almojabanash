import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { createApp } from "../server/app.ts";
import { initialCatalog } from "../shared/inventory.ts";

const movement = (
  productId: string,
  type = "opening",
  quantity = 10,
  extra: Record<string, unknown> = {},
) => ({
  id: randomUUID(),
  productId,
  type,
  quantity,
  unit: "unidad",
  reason: "Movimiento de prueba",
  ...extra,
});

test("user catalog has no invented prices, quantities or units and initializes only once", async () => {
  const directory = mkdtempSync(join(tmpdir(), "almo-stock-")),
    path = join(directory, "inventory.sqlite");
  let instance = createApp(path, undefined, {});
  try {
    const { app } = instance;
    const products = (
      await request(app).get("/api/inventory/products").expect(200)
    ).body;
    assert.equal(products.length, 40);
    assert.deepEqual(
      new Set(products.map((p: { name: string }) => p.name)),
      new Set(Object.values(initialCatalog).flat()),
    );
    for (const product of products) {
      assert.equal(product.stock, null);
      assert.equal(product.retailPrice, null);
      assert.equal(product.wholesalePrice, null);
      assert.equal(product.costPrice, null);
      assert.equal(product.unit, "");
      assert.equal(product.currency, "");
    }
    const product = products[0];
    await request(app)
      .patch(`/api/inventory/products/${product.id}`)
      .send({
        name: "Nombre corregido por el usuario",
        retailPrice: 1500,
        currency: "COP",
      })
      .expect(200);
    await request(app)
      .post("/api/inventory/movements")
      .send(movement(product.id, "opening", 5))
      .expect(201);
    await request(app)
      .patch(`/api/inventory/products/${products[1].id}`)
      .send({ active: false })
      .expect(200);
    const lead = (
      await request(app)
        .post("/api/leads")
        .send({
          name: "Contacto conservado",
          nextContactAt: "2026-12-01T12:00:00.000Z",
        })
        .expect(201)
    ).body;
    await request(app)
      .post(`/api/leads/${lead.id}/notes`)
      .send({ body: "Nota conservada" })
      .expect(201);
    const before = (await request(app).get(`/api/leads/${lead.id}`)).body;
    instance.close();
    instance = createApp(path, undefined, {});
    const after = (
      await request(instance.app).get(
        "/api/inventory/products?includeArchived=1",
      )
    ).body;
    assert.equal(after.length, 40);
    assert.equal(
      after.find((p: { id: string }) => p.id === product.id).stock,
      5,
    );
    assert.equal(
      (
        await request(instance.app).get(
          `/api/inventory/movements?productId=${product.id}`,
        )
      ).body.total,
      1,
    );
    assert.equal(
      after.find((p: { id: string }) => p.id === product.id).retailPrice,
      1500,
    );
    assert.equal(
      after.find((p: { id: string }) => p.id === products[1].id).active,
      false,
    );
    assert.equal(
      after.filter((p: { name: string }) => p.name === product.name).length,
      0,
    );
    assert.deepEqual(
      (await request(instance.app).get(`/api/leads/${lead.id}`)).body,
      before,
    );
  } finally {
    instance.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stock ledger is exact, rejects negative balances and makes retried writes idempotent", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const product = (
    await request(app)
      .post("/api/inventory/products")
      .send({ name: "Producto de prueba", unit: "unidad" })
      .expect(201)
  ).body;
  const lead = (
    await request(app).post("/api/leads").send({ name: "Comprador de prueba" })
  ).body;
  const opening = movement(product.id, "opening", 0);
  await request(app).post("/api/inventory/movements").send(opening).expect(201);
  await request(app).post("/api/inventory/movements").send(opening).expect(200);
  await request(app)
    .post("/api/inventory/movements")
    .send({ ...opening, quantity: 1 })
    .expect(409);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "opening", 1))
    .expect(409);
  for (const [type, quantity] of [
    ["purchase", 0.1],
    ["production", 0.2],
    ["sale", 0.1],
    ["return", 0.001],
    ["waste", 0.001],
    ["adjustment_in", 0.1],
    ["adjustment_out", 0.1],
  ] as const) {
    await request(app)
      .post("/api/inventory/movements")
      .send(
        movement(
          product.id,
          type,
          quantity,
          type === "sale" ? { leadId: lead.id } : {},
        ),
      )
      .expect(201);
  }
  const products = (await request(app).get("/api/inventory/products")).body;
  assert.equal(
    products.find((p: { id: string }) => p.id === product.id).stock,
    0.2,
  );
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "sale", 0.201))
    .expect(409);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "sale", 0))
    .expect(400);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "purchase", 0.0001))
    .expect(400);
  const ledger = (
    await request(app).get(`/api/inventory/movements?productId=${product.id}`)
  ).body;
  assert.equal(ledger.total, 8);
  assert.equal(ledger.items[0].balance, 0.2);
  assert.equal(
    ledger.items.find((m: { type: string }) => m.type === "sale").leadId,
    lead.id,
  );
  assert.equal(
    (await request(app).get(`/api/leads/${lead.id}`)).body.lead.stage,
    "new",
    "Stock movements do not imply a commercial close",
  );
});

test("simultaneous stock exits cannot oversell and duplicate requests cannot apply twice", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const product = (
    await request(app)
      .post("/api/inventory/products")
      .send({ name: "Control concurrente" })
  ).body;
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "opening", 100))
    .expect(201);
  const exits = await Promise.all(
    [60, 60].map((q) =>
      request(app)
        .post("/api/inventory/movements")
        .send(movement(product.id, "sale", q)),
    ),
  );
  assert.deepEqual(exits.map((result) => result.status).sort(), [201, 409]);
  const duplicate = movement(product.id, "purchase", 10);
  const receipts = await Promise.all(
    [duplicate, duplicate].map((input) =>
      request(app).post("/api/inventory/movements").send(input),
    ),
  );
  assert.deepEqual(receipts.map((result) => result.status).sort(), [200, 201]);
  assert.equal(
    (await request(app).get(`/api/inventory/movements?productId=${product.id}`))
      .body.total,
    3,
  );
  assert.equal(
    (await request(app).get("/api/inventory/products")).body.find(
      (p: { id: string }) => p.id === product.id,
    ).stock,
    50,
  );
});

test("product edits validate prices and uniqueness, preserve stock units and archive without deleting history", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  await request(app)
    .post("/api/inventory/products")
    .send({ name: "Precio sin moneda", retailPrice: 2000 })
    .expect(400);
  await request(app)
    .post("/api/inventory/products")
    .send({ name: "Precio impreciso", retailPrice: 1.001, currency: "COP" })
    .expect(400);
  await request(app)
    .post("/api/inventory/products")
    .send({ name: "Precio negativo", retailPrice: -1, currency: "COP" })
    .expect(400);
  const product = (
    await request(app)
      .post("/api/inventory/products")
      .send({
        name: "Producto con presentación",
        presentation: "Porción",
        code: "SKU-TEST",
        retailPrice: 0,
        currency: "COP",
      })
      .expect(201)
  ).body;
  await request(app)
    .post("/api/inventory/products")
    .send({ name: "Otra cosa", code: "sku-test" })
    .expect(409);
  await request(app)
    .post("/api/inventory/products")
    .send({ name: "producto con presentación", presentation: "porción" })
    .expect(409);
  await request(app)
    .post("/api/inventory/products")
    .send({ name: product.name, presentation: "Otra presentación" })
    .expect(201);
  await request(app)
    .patch(`/api/inventory/products/${product.id}`)
    .send({ stock: 500 })
    .expect(400);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "sale", 1))
    .expect(409);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "opening", 2, { unit: "" }))
    .expect(400);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "opening", 2))
    .expect(201);
  await request(app)
    .patch(`/api/inventory/products/${product.id}`)
    .send({ unit: "kg" })
    .expect(409);
  await request(app)
    .patch(`/api/inventory/products/${product.id}`)
    .send({ active: false })
    .expect(409);
  await request(app)
    .post("/api/inventory/movements")
    .send(
      movement(product.id, "waste", 2, {
        reason: "Corrección del conteo de prueba",
      }),
    )
    .expect(201);
  await request(app)
    .patch(`/api/inventory/products/${product.id}`)
    .send({ active: false })
    .expect(200);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(product.id, "purchase", 1))
    .expect(409);
  const list = (await request(app).get("/api/inventory/products")).body;
  assert.ok(!list.some((p: { id: string }) => p.id === product.id));
  await request(app)
    .patch(`/api/inventory/products/${product.id}`)
    .send({ active: true, wholesalePrice: 1000, minimumStock: 5 })
    .expect(200);
  assert.equal(
    (await request(app).get(`/api/inventory/movements?productId=${product.id}`))
      .body.total,
    2,
  );
});

test("movement history filters and paginates without mutation; cross-origin writes and malformed inputs are rejected", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const products = (await request(app).get("/api/inventory/products")).body;
  const first = movement(products[0].id),
    second = movement(products[1].id);
  await request(app)
    .post("/api/inventory/movements")
    .set("Origin", "https://other.example")
    .send(first)
    .expect(403);
  await request(app)
    .post("/api/inventory/products")
    .set("Origin", "https://other.example")
    .send({ name: "Rechazado" })
    .expect(403);
  await request(app).post("/api/inventory/movements").send(first).expect(201);
  await request(app).post("/api/inventory/movements").send(second).expect(201);
  const page1 = (
    await request(app).get("/api/inventory/movements?limit=1&page=1")
  ).body;
  const page2 = (
    await request(app).get("/api/inventory/movements?limit=1&page=2")
  ).body;
  assert.equal(page1.total, 2);
  assert.notEqual(page1.items[0].id, page2.items[0].id);
  assert.equal(
    (
      await request(app).get(
        `/api/inventory/movements?productId=${first.productId}`,
      )
    ).body.items[0].id,
    first.id,
  );
  await request(app).get("/api/inventory/movements?limit=0").expect(400);
  await request(app)
    .get("/api/inventory/movements?productId=invalid")
    .expect(400);
  await request(app)
    .patch(`/api/inventory/movements/${first.id}`)
    .send({ quantity: 99 })
    .expect(404);
  await request(app).delete(`/api/inventory/movements/${first.id}`).expect(404);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(first.productId, "sale", 1, { leadId: randomUUID() }))
    .expect(400);
  await request(app)
    .post("/api/inventory/movements")
    .send(movement(first.productId, "sale", 1, { unit: "kg" }))
    .expect(409);
  assert.equal(
    (await request(app).get("/api/inventory/movements")).body.total,
    2,
  );
});
