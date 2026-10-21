import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import request from "supertest";
import { createApp } from "../server/app.ts";

// Deliberately fake credentials, used only with in-process requests and a mocked transport.
const config = {
  appSecret: "test-only-signing-secret",
  verifyToken: "test-only-challenge",
  accessToken: "test-only-token",
  phoneNumberId: "123",
  graphVersion: "v99.0",
};
function event(id: string, body: string, account = "123") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: account },
              contacts: [
                { wa_id: "555", profile: { name: "Contacto de prueba" } },
              ],
              messages: [
                {
                  id,
                  from: "555",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
function signed(app: ReturnType<typeof createApp>["app"], payload: unknown) {
  const body = JSON.stringify(payload);
  const signature =
    "sha256=" +
    createHmac("sha256", config.appSecret).update(body).digest("hex");
  return request(app)
    .post("/api/integrations/meta/webhook")
    .set("Content-Type", "application/json")
    .set("x-hub-signature-256", signature)
    .send(body);
}

test("webhook validates challenge, signature and account, deduplicates events, and drafts replies", async (t) => {
  const instance = createApp(":memory:", undefined, config);
  t.after(instance.close);
  const { app } = instance;
  await request(app)
    .get("/api/integrations/meta/webhook")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": config.verifyToken,
      "hub.challenge": "challenge123",
    })
    .expect(200, "challenge123");
  await request(app)
    .get("/api/integrations/meta/webhook")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "123",
    })
    .expect(403);
  await request(app)
    .post("/api/integrations/meta/webhook")
    .send(event("1", "Hola"))
    .expect(403);
  await signed(app, event("wrong-account", "Hola", "999")).expect(403);
  await signed(app, event("1", "Hola")).expect(200);
  await signed(app, event("1", "Hola")).expect(200);
  let leads = await request(app).get("/api/leads");
  assert.equal(leads.body.length, 1);
  assert.equal(
    leads.body[0].source,
    "WhatsApp",
    "Incoming webhook records its channel without a manual selection",
  );
  const id = leads.body[0].id;
  let thread = await request(app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.messages.length, 2);
  assert.equal(thread.body.messages[1].state, "draft");
  await instance.dispatchMessages();
  thread = await request(app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.messages[1].state, "draft"); // Real sending remains disabled.
  const inputs = [
    "ACEPTO",
    "Hotel",
    "100",
    "Ciudad de prueba",
    "Comprador de prueba",
    "SÍ",
  ];
  for (const [i, text] of inputs.entries())
    await signed(app, event(String(i + 2), text)).expect(200);
  leads = await request(app).get("/api/leads");
  assert.equal(leads.body.length, 1);
  assert.equal(leads.body[0].stage, "conversation");
  assert.equal(leads.body[0].name, "Comprador de prueba");
  thread = await request(app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.session.profile.sampleRequested, true);
  assert.equal(thread.body.session.state, "ready");
  await signed(app, event("stop", "SALIR")).expect(200);
  thread = await request(app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.session.state, "opted_out");
  assert.equal(
    thread.body.messages.filter((m: { state: string }) => m.state === "draft")
      .length,
    1,
  );
  assert.match(thread.body.messages.at(-1).body, /Detuvimos/);
});

test("outbound transport uses WhatsApp API, marks success once, and never retries an ambiguous failure", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const instance = createApp(":memory:", undefined, {
    ...config,
    sendEnabled: true,
  });
  t.after(instance.close);
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    assert.equal(
      String(input),
      "https://graph.facebook.com/v99.0/123/messages",
    );
    assert.equal(
      JSON.parse(String(options?.body)).messaging_product,
      "whatsapp",
    );
    return new Response(
      JSON.stringify({ messages: [{ id: "fake-provider-id" }] }),
      { status: 200 },
    );
  };
  await signed(instance.app, event("1", "Hola"));
  await instance.dispatchMessages();
  await instance.dispatchMessages();
  assert.equal(calls, 1);
  const list = await request(instance.app).get("/api/leads");
  const id = list.body[0].id;
  let thread = await request(instance.app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.messages.at(-1).state, "sent");
  globalThis.fetch = async () => {
    calls++;
    throw new Error("simulated network failure");
  };
  await signed(instance.app, event("2", "ACEPTO"));
  await instance.dispatchMessages();
  await instance.dispatchMessages();
  assert.equal(calls, 2);
  thread = await request(instance.app).get(`/api/leads/${id}/messages`);
  assert.equal(thread.body.messages.at(-1).state, "unknown");
});

test("missing Meta credentials are reported without exposing values; simulation is isolated", async (t) => {
  const { app, close } = createApp(":memory:", undefined, {});
  t.after(close);
  const status = await request(app)
    .get("/api/integrations/meta/status")
    .expect(200);
  assert.equal(status.body.configured, false);
  assert.equal(status.body.sendingEnabled, false);
  await request(app)
    .post("/api/integrations/meta/webhook")
    .send({})
    .expect(503);
  const simulation = await request(app)
    .post("/api/bot/simulate")
    .send({ message: "Hola", session: null })
    .expect(200);
  assert.equal(simulation.body.state, "consent");
  const leads = await request(app).get("/api/leads");
  assert.equal(leads.body.length, 0);
});

test("old inbound messages never trigger a new session send", async (t) => {
  const instance = createApp(":memory:", undefined, {
    ...config,
    sendEnabled: true,
  });
  t.after(instance.close);
  const payload = event("old", "Hola");
  payload.entry[0].changes[0].value.messages[0].timestamp = String(
    Math.floor(Date.now() / 1000) - 90000,
  );
  await signed(instance.app, payload).expect(200);
  const leads = await request(instance.app).get("/api/leads");
  const thread = await request(instance.app).get(
    `/api/leads/${leads.body[0].id}/messages`,
  );
  assert.equal(thread.body.messages.at(-1).state, "expired");
});
