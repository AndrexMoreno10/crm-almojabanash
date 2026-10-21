import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceBot, type BotSession } from "../server/bot.ts";

test("qualifies a wholesale buyer and records a sample request without promising delivery or a sale", () => {
  let session: BotSession | null = null;
  const messages = [
    "Hola",
    "ACEPTO",
    "Hotel",
    "100",
    "Ciudad de prueba",
    "Contacto de prueba",
    "sí",
  ];
  for (const message of messages) session = advanceBot(session, message);
  assert.ok(session);
  assert.equal(session.state, "ready");
  assert.deepEqual(session.profile, {
    segment: "Hotel",
    quantity: 100,
    city: "Ciudad de prueba",
    name: "Contacto de prueba",
    sampleRequested: true,
  });
  const result = advanceBot({ state: "sample", profile: {} }, "sí");
  assert.equal(result.handoff, true);
  assert.match(result.reply!, /no confirma una venta ni un envío/);
});

test("explicit opt-out stops the assistant at every stage", () => {
  for (const state of [
    "consent",
    "segment",
    "quantity",
    "city",
    "name",
    "sample",
    "ready",
    "human",
  ] as const) {
    const result = advanceBot({ state, profile: {} }, "SALIR");
    assert.equal(result.state, "opted_out");
    assert.equal(result.optedOut, true);
    assert.equal(advanceBot(result, "hola").reply, null);
  }
  assert.equal(
    advanceBot({ state: "consent", profile: {} }, "No").state,
    "opted_out",
  );
});

test("unknown business facts and human requests pause automation", () => {
  for (const message of [
    "¿Cuál es el precio?",
    "¿Dónde están ubicados?",
    "Tengo una alergia",
    "Quiero hablar con un asesor",
  ]) {
    const result = advanceBot({ state: "quantity", profile: {} }, message);
    assert.equal(result.state, "human");
    assert.equal(result.handoff, true);
    assert.equal(advanceBot(result, "hola").reply, null);
  }
  assert.equal(
    advanceBot({ state: "quantity", profile: {} }, "no sé todavía").state,
    "human",
  );
});

test("no consent is inferred from silence or unrelated messages", () => {
  assert.equal(advanceBot(null, "100").state, "consent");
  assert.equal(
    advanceBot({ state: "consent", profile: {} }, "hola").state,
    "consent",
  );
});
