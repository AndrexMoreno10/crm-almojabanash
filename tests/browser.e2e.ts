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
      ["node_modules/tsx/dist/cli.mjs", "scripts/review-local.ts", "--no-open"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CRM_REVIEW_PORT: "3101",
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
        .getByRole("heading", {
          name: "Tu operación, de un vistazo.",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".kanban").count(), 0);
      await page
        .getByRole("button", { name: "Embudo de ventas", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Tu embudo de ventas", exact: false })
        .waitFor();
      assert.equal(
        await page
          .getByRole("region", { name: "Resumen comercial", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("region", { name: "Nuevo lead", exact: true })
        .waitFor();
      assert.equal(await page.locator(".kanban-column").count(), 8);
      for (const name of [
        "Nuevo lead",
        "En atención",
        "Información comercial enviada",
        "Interés confirmado",
        "Muestra en evaluación",
        "Pedido en cierre",
        "Primera compra realizada",
        "Cliente recurrente",
      ])
        await page.getByRole("region", { name, exact: true }).waitFor();
      await page.reload();
      await page
        .getByRole("heading", { name: "Embudo de ventas", exact: true })
        .waitFor();
      await page.goBack();
      await page
        .getByRole("heading", {
          name: "Tu operación, de un vistazo.",
          exact: true,
        })
        .waitFor();
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
      await page
        .getByLabel("Próximo contacto (hora de tu navegador)")
        .fill("2026-01-01T10:00");
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
        .getByRole("region", { name: "En atención", exact: true })
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
      const card = page.locator("article.lead-card").filter({
        has: page.getByRole("heading", {
          name: "Hotel de prueba",
          exact: true,
        }),
      });
      await card.dragTo(
        page.getByRole("region", { name: "Nuevo lead", exact: true }),
      );
      await page
        .getByRole("region", { name: "Nuevo lead", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page
        .getByRole("combobox", {
          name: "Etapa de Hotel de prueba",
          exact: true,
        })
        .selectOption("conversation");
      await page
        .getByRole("region", { name: "En atención", exact: true })
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
      const stageSelect = () =>
        page.getByRole("combobox", {
          name: "Etapa de Hotel de prueba",
          exact: true,
        });
      await stageSelect().selectOption("lost");
      await page
        .getByRole("button", {
          name: "Ver oportunidades perdidas",
          exact: true,
        })
        .click();
      await page
        .getByRole("region", { name: "Oportunidades perdidas", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await stageSelect().selectOption("interested");
      await page
        .getByRole("heading", {
          name: "Sin oportunidades perdidas",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", { name: "Ver embudo de ocho etapas", exact: true })
        .click();
      for (const [stage, label] of [
        ["sample", "Muestra en evaluación"],
        ["closing", "Pedido en cierre"],
        ["won", "Primera compra realizada"],
      ]) {
        await stageSelect().selectOption(stage);
        await page
          .getByRole("region", { name: label, exact: true })
          .getByRole("heading", { name: "Hotel de prueba", exact: true })
          .waitFor();
      }
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      assert.equal(
        await page
          .locator("article.metric")
          .filter({ hasText: "Clientes en la etapa de primera compra" })
          .locator("strong")
          .innerText(),
        "1",
      );
      await page
        .getByRole("button", { name: "Embudo de ventas", exact: true })
        .click();
      await stageSelect().selectOption("recurring");
      await page
        .getByRole("region", { name: "Cliente recurrente", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("region", { name: "Cliente recurrente", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      assert.equal(
        await page
          .locator("article.metric")
          .filter({ hasText: "Clientes en la etapa de primera compra" })
          .locator("strong")
          .innerText(),
        "0",
      );
      assert.equal(
        await page
          .locator("article.metric")
          .filter({ hasText: "Clasificados como compradores recurrentes" })
          .locator("strong")
          .innerText(),
        "1",
      );
      assert.equal(
        await page
          .locator("article.metric")
          .filter({ hasText: "Oportunidades abiertas" })
          .locator("strong")
          .innerText(),
        "0",
      );
      assert.equal(
        await page
          .locator("article.metric")
          .filter({ hasText: "Tasa de cierre" })
          .locator("strong")
          .innerText(),
        "100%",
      );
      await page.screenshot({
        path: "/tmp/almo-crm-overview.png",
        fullPage: true,
      });

      await page
        .getByRole("region", { name: /Seguimientos por atender/ })
        .getByRole("button")
        .filter({ hasText: "Hotel de prueba" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
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
        .getByRole("button", { name: "Embudo de ventas", exact: true })
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
