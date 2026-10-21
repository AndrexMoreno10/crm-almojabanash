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

test("answers confirmed location and coverage without losing qualification progress", () => {
  const location = advanceBot(
    { state: "quantity", profile: { segment: "Hotel" } },
    "¿Dónde están ubicados?",
  );
  assert.equal(location.state, "quantity");
  assert.equal(location.profile.segment, "Hotel");
  assert.match(location.reply!, /única sede/);
  assert.match(location.reply!, /Armenia, Quindío/);
  assert.match(location.reply!, /Cra\. 14 #11-56/);
  assert.match(location.reply!, /3152457853/);
  assert.match(location.reply!, /Cuántas unidades/);
  const coverage = advanceBot(null, "¿Qué municipios atienden?");
  for (const city of [
    "Armenia",
    "Buenavista",
    "Calarcá",
    "Circasia",
    "Filandia",
    "Montenegro",
    "Salento",
    "La Tebaida",
  ])
    assert.ok(coverage.reply!.includes(city));
  assert.equal(coverage.state, "consent");
  assert.match(coverage.reply!, /no confirma un envío/);
  assert.equal(
    advanceBot(
      { state: "quantity", profile: {} },
      "¿Cuánto cuesta el envío a Pereira?",
    ).state,
    "human",
  );
});

test("known business answers never restart a paused or opted-out assistant", () => {
  for (const state of ["human", "opted_out"] as const) {
    assert.equal(
      advanceBot({ state, profile: {} }, "¿Dónde están ubicados?").reply,
      null,
    );
    assert.equal(
      advanceBot({ state, profile: {} }, "¿Qué ciudades atienden?").reply,
      null,
    );
  }
});
