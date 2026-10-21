import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

test(
  "browser: create opportunity, save note and stage, reload, use assistant, and render on mobile",
  { timeout: 180000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "almo-browser-"));
    const server = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "server/main.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: "3101",
          CRM_DATABASE_PATH: join(directory, "browser.sqlite"),
          META_SEND_ENABLED: "false",
        },
        stdio: "pipe",
      },
    );
    let output = "";
    server.stderr.on("data", (data) => {
      output += String(data);
    });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try {
          const r = await fetch("http://127.0.0.1:3101/api/health");
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.ok(ready, `Server did not start: ${output}`);
      browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
        headless: true,
        args: ["--no-sandbox"],
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400)
          console.error(
            "Browser request failed:",
            response.status(),
            new URL(response.url()).pathname,
          );
      });
      await page.goto("http://127.0.0.1:3101");
      await page
        .getByRole("button", { name: "Nueva oportunidad", exact: true })
        .click();
      await page.getByLabel("Nombre del contacto").fill("Hotel de prueba");
      await page
        .getByLabel("Responsable", { exact: true })
        .fill("Equipo de prueba");
      await page
        .getByLabel("Teléfono", { exact: true })
        .fill("+57 300 555 5555");
      await page.getByLabel("Canal de origen").fill("WhatsApp");
      await page.getByLabel("Valor estimado").fill("150000");
      await page
        .getByRole("button", { name: "Crear oportunidad", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("combobox", {
          name: "Etapa de Hotel de prueba",
          exact: true,
        })
        .selectOption("conversation");
      await page
        .getByRole("region", { name: "En conversación", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      const alerts = await page.getByRole("alert").allTextContents();
      assert.deepEqual(alerts, []);
      await page
        .getByRole("button")
        .filter({
          has: page.getByRole("heading", {
            name: "Hotel de prueba",
            exact: true,
          }),
        })
        .click();
      await page.getByRole("dialog").waitFor({ timeout: 8000 });
      assert.deepEqual(errors, []);
      const whatsapp = page.getByRole("link", {
        name: "Abrir conversación en WhatsApp",
        exact: true,
      });
      assert.equal(
        await whatsapp.getAttribute("href"),
        "https://wa.me/573005555555",
      );
      await page.getByLabel("Etapa", { exact: true }).selectOption("proposal");
      await page
        .getByRole("button", { name: "Guardar cambios", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Cambios guardados" })
        .waitFor();
      await page
        .getByRole("textbox", { name: "Nueva nota" })
        .fill("Quiere evaluar una muestra. Pendiente de confirmar.");
      await page
        .getByRole("button", { name: "Agregar nota", exact: true })
        .click();
      await page
        .getByText("Quiere evaluar una muestra. Pendiente de confirmar.", {
          exact: true,
        })
        .waitFor();
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      const card = page
        .locator("article.lead-card")
        .filter({
          has: page.getByRole("heading", {
            name: "Hotel de prueba",
            exact: true,
          }),
        });
      await card.dragTo(
        page.getByRole("region", { name: "Nuevo contacto", exact: true }),
      );
      await page
        .getByRole("region", { name: "Nuevo contacto", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page
        .getByRole("combobox", {
          name: "Etapa de Hotel de prueba",
          exact: true,
        })
        .selectOption("conversation");
      await page
        .getByRole("region", { name: "En conversación", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("button")
        .filter({
          has: page.getByRole("heading", {
            name: "Hotel de prueba",
            exact: true,
          }),
        })
        .waitFor();
      const leads = await (
        await page.request.get("http://127.0.0.1:3101/api/leads")
      ).json();
      assert.equal(leads.length, 1);
      assert.equal(leads[0].stage, "conversation");
      assert.equal(leads[0].value, 150000);
      const history = await (
        await page.request.get(`http://127.0.0.1:3101/api/leads/${leads[0].id}`)
      ).json();
      assert.equal(
        history.activities.filter((item: { body: string }) =>
          item.body.startsWith("Etapa:"),
        ).length,
        4,
      );
      await page
        .getByRole("button", { name: "Asistente de ventas", exact: true })
        .click();
      for (const message of [
        "Hola",
        "ACEPTO",
        "Hotel",
        "100",
        "Ciudad de prueba",
        "Comprador de prueba",
        "SÍ",
      ]) {
        await page
          .getByRole("textbox", { name: "Mensaje de prueba" })
          .fill(message);
        await page
          .getByRole("button", { name: "Enviar mensaje de prueba" })
          .click();
        await page.waitForFunction(
          () =>
            !(
              document.querySelector(
                'input[aria-label="Mensaje de prueba"]',
              ) as HTMLInputElement
            )?.value,
        );
      }
      await page
        .getByText("Sí, pendiente de aprobación", { exact: true })
        .waitFor();
      await page
        .getByText("Esto todavía no confirma una venta ni un envío.", {
          exact: false,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Oportunidades", exact: true })
        .click();
      await page.screenshot({
        path: "/tmp/almo-crm-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "/tmp/almo-crm-mobile.png",
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      assert.equal(
        overflow,
        false,
        "Page should fit a mobile viewport; the board itself may scroll",
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (server.exitCode !== null) resolve();
        else server.once("exit", () => resolve());
      });
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
