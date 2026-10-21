import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

test(
  "browser: create opportunity, save note and stage, reload, use assistant, and render on mobile",
  { timeout: 300000 },
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
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
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
      const audit = async (name: string) => {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          results.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          })),
          [],
          `Accesibilidad: ${name}`,
        );
      };
      const changeHotelStage = async (stage: string) => {
        await page
          .getByRole("button", {
            name: "Ver detalle de Hotel de prueba",
            exact: true,
          })
          .click();
        await page.getByLabel("Etapa", { exact: true }).selectOption(stage);
        const saved = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/leads") &&
            response.request().method() === "GET",
        );
        await page
          .getByRole("button", { name: "Guardar cambios", exact: true })
          .click();
        assert.equal((await saved).status(), 200);
        await page.waitForFunction(() =>
          Array.from(document.querySelectorAll("button")).some(
            (button) =>
              button.textContent?.trim() === "Guardar cambios" &&
              !button.disabled,
          ),
        );
        await page.getByRole("button", { name: "Cerrar", exact: true }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      };
      await page.goto("http://127.0.0.1:3101");
      await page
        .getByRole("heading", {
          name: "Panel comercial",
          exact: true,
        })
        .waitFor();
      await audit("resumen vacío");
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
          name: "Panel comercial",
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
      assert.equal(await page.locator(".lead-card select").count(), 0);
      await page
        .getByRole("img", { name: "Sin revisar en CRM", exact: true })
        .waitFor();
      const openHotel = page.getByRole("button", {
        name: "Ver detalle de Hotel de prueba",
        exact: true,
      });
      await openHotel.focus();
      const reviewed = page.waitForResponse(
        (response) =>
          response.url().endsWith("/review") &&
          response.request().method() === "POST",
      );
      await openHotel.press("Enter");
      assert.equal((await reviewed).status(), 200);
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      await page
        .getByRole("region", { name: "Nuevo lead", exact: true })
        .getByRole("img", { name: "Revisado en CRM", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("region", { name: "Nuevo lead", exact: true })
        .getByRole("img", { name: "Revisado en CRM", exact: true })
        .waitFor();
      await changeHotelStage("conversation");
      await page
        .getByRole("region", { name: "En atención", exact: true })
        .getByRole("heading", { name: "Hotel de prueba", exact: true })
        .waitFor();
      await page
        .getByRole("img", { name: "Revisado en CRM", exact: true })
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
      await page
        .locator('.detail-avatar img[src="/icons/whatsapp.svg"]')
        .waitFor();
      await audit("ficha de contacto");
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
      await page.getByRole("tab", { name: "Actividad", exact: true }).click();
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
      await changeHotelStage("conversation");
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
      await changeHotelStage("lost");
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
      await changeHotelStage("interested");
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
        await changeHotelStage(stage);
        await page
          .getByRole("region", { name: label, exact: true })
          .getByRole("heading", { name: "Hotel de prueba", exact: true })
          .waitFor();
        if (stage === "closing") {
          await page
            .getByRole("button", { name: "Resumen", exact: true })
            .click();
          await page.getByRole("tab", { name: /^Por cerrar/ }).click();
          await page
            .getByRole("button", {
              name: "Ver detalle de Hotel de prueba",
              exact: true,
            })
            .waitFor();
          await page
            .getByRole("button", { name: "Ver todos", exact: true })
            .click();
          assert.match(page.url(), /attention=closing/);
          assert.equal(await page.locator(".table-wrap tbody tr").count(), 1);
          await page
            .getByRole("button", { name: "Embudo de ventas", exact: true })
            .click();
        }
      }
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      assert.equal(
        await page
          .locator(".sales-results > span")
          .filter({ hasText: "Primera compra" })
          .locator("strong")
          .innerText(),
        "1",
      );
      await page
        .getByRole("button", { name: "Embudo de ventas", exact: true })
        .click();
      await changeHotelStage("recurring");
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
          .locator(".sales-results > span")
          .filter({ hasText: "Primera compra" })
          .locator("strong")
          .innerText(),
        "0",
      );
      assert.equal(
        await page
          .locator(".sales-results > span")
          .filter({ hasText: "Recurrentes" })
          .locator("strong")
          .innerText(),
        "1",
      );
      assert.equal(
        await page
          .locator(".metrics, .funnel-breakdown, .recent-panel")
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("tab", { name: /^Seguimientos/ })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: /^Seguimientos/ }).click();
      await page
        .getByRole("button", {
          name: "Ver detalle de Hotel de prueba",
          exact: true,
        })
        .waitFor();
      await page.getByText("Retomar seguimiento", { exact: true }).waitFor();
      await audit("resumen con oportunidades");
      await page.screenshot({
        path: "/tmp/almo-crm-overview.png",
        fullPage: true,
      });

      await page
        .getByRole("region", { name: "A quién contactar", exact: true })
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
      await audit("asistente");
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
      const longName =
        "Hotel de eventos y convenciones del Eje Cafetero con un nombre comercial largo para comprobar la ficha y las columnas";
      await page.request.post("http://127.0.0.1:3101/api/leads", {
        data: {
          name: longName,
          owner: "Equipo comercial de ventas al por mayor",
          source: "Instagram",
        },
      });
      await page.request.post("http://127.0.0.1:3101/api/leads", {
        data: {
          name: "Contacto descartado",
          stage: "lost",
          lostReason: "No requiere producto por ahora",
        },
      });
      const denseContacts = await Promise.all(
        Array.from({ length: 9 }, (_, index) =>
          page.request.post("http://127.0.0.1:3101/api/leads", {
            data: {
              name: `Contacto de prueba ${String(index + 1).padStart(2, "0")}`,
              source: index === 7 ? "" : index === 6 ? "Facebook" : "WhatsApp",
              phone: "+57 300 000 0000",
            },
          }),
        ),
      );
      denseContacts.forEach((response) => assert.equal(response.status(), 201));
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await page
        .getByRole("heading", { name: longName, exact: true })
        .waitFor();
      const newColumn = page.getByRole("region", {
        name: "Nuevo lead",
        exact: true,
      });
      const existingCard = newColumn
        .locator(".lead-card")
        .filter({ hasText: "Contacto de prueba 09" });
      await existingCard
        .locator('.lead-avatar img[src="/icons/whatsapp.svg"]')
        .waitFor();
      await page.reload();
      await existingCard
        .locator('.lead-avatar img[src="/icons/whatsapp.svg"]')
        .waitFor();
      assert.equal(await existingCard.locator(".card-channel img").count(), 0);
      assert.equal(
        await newColumn
          .getByRole("combobox", { name: /^Canal de origen/ })
          .count(),
        0,
      );
      const unknownCard = newColumn
        .locator(".lead-card")
        .filter({ hasText: "Contacto de prueba 08" });
      assert.equal(
        await unknownCard.locator(".lead-avatar img").count(),
        0,
        "A phone alone does not imply WhatsApp",
      );
      await newColumn
        .locator(".lead-card")
        .filter({ hasText: "Contacto de prueba 07" })
        .locator('.lead-avatar img[src="/icons/facebook.svg"]')
        .waitFor();
      await newColumn
        .locator(".lead-card")
        .filter({ hasText: longName })
        .locator('.lead-avatar img[src="/icons/instagram.svg"]')
        .waitFor({ state: "attached" });
      assert.equal(
        await existingCard
          .locator("img.source-logo")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth > 0),
        true,
      );
      assert.equal(
        await newColumn.locator(".column-count").textContent(),
        "10",
      );
      const layout = await newColumn.evaluate((column) => {
        const list = column.querySelector(".column-cards")!;
        const bounds = list.getBoundingClientRect();
        const cards = Array.from(list.querySelectorAll(".lead-card")).map(
          (card) => card.getBoundingClientRect(),
        );
        return {
          scrolls: list.scrollHeight > list.clientHeight,
          visibleCards: cards.filter(
            (card) => card.top >= bounds.top && card.bottom <= bounds.bottom,
          ).length,
          maxHeight: Math.max(...cards.map((card) => card.height)),
          minWidth: Math.min(...cards.map((card) => card.width)),
          firstTop: cards[0].top,
          pageOverflow: document.documentElement.scrollHeight > innerHeight + 2,
        };
      });
      assert.ok(layout.scrolls, "Ten leads scroll within their own column");
      assert.ok(
        layout.visibleCards >= 4,
        "At least four complete cards remain visible on desktop",
      );
      assert.ok(
        layout.maxHeight < 170,
        "Long names do not create oversized cards",
      );
      assert.ok(layout.minWidth >= 275, "Cards have enough horizontal space");
      assert.ok(
        layout.firstTop < 300,
        "Leads appear above the fold after the compact toolbar",
      );
      assert.equal(
        layout.pageOverflow,
        false,
        "Ten leads do not stretch the page",
      );
      const minimalCard = newColumn
        .locator(".lead-card")
        .filter({ hasText: "Contacto de prueba 01" });
      assert.doesNotMatch(
        (await minimalCard.textContent()) || "",
        /Sin campaña|Sin responsable|valor estimado/,
      );
      const beforeScroll = await page.evaluate(() => scrollY);
      await newColumn
        .locator(".column-cards")
        .evaluate((list) => (list.scrollTop = list.scrollHeight));
      const longCard = newColumn.getByRole("button", {
        name: `Ver detalle de ${longName}`,
        exact: true,
      });
      await longCard.click();
      await page
        .getByRole("dialog")
        .getByRole("heading", { name: longName, exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      assert.equal(await page.evaluate(() => scrollY), beforeScroll);
      await newColumn
        .locator(".column-cards")
        .evaluate((list) => (list.scrollTop = 0));
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      const reviewAction = () =>
        page.getByRole("button", { name: /^Sin revisar en CRM/ });
      assert.equal(await reviewAction().locator("strong").textContent(), "9");
      await reviewAction().click();
      assert.match(page.url(), /contacts\?attention=unreviewed/);
      assert.equal(await page.locator(".table-wrap tbody tr").count(), 9);
      const reviewResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/review") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: /Contacto de prueba 01/ }).click();
      assert.equal((await reviewResponse).status(), 200);
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      assert.equal(await page.locator(".table-wrap tbody tr").count(), 8);
      await page.reload();
      await page
        .getByRole("heading", { name: "Sin revisar en CRM", exact: false })
        .waitFor();
      await page.locator(".table-wrap tbody tr").first().waitFor();
      assert.equal(await page.locator(".table-wrap tbody tr").count(), 8);
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      assert.equal(await reviewAction().locator("strong").textContent(), "8");
      await page.getByRole("tab", { name: /^Por atender/ }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page
          .getByRole("tab", { name: /^Seguimientos/ })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("ArrowLeft");
      await page.getByRole("tab", { name: /^Por atender/ }).click();
      await page
        .getByRole("button", { name: "Ver todos", exact: true })
        .click();
      assert.equal(
        await page.locator(".table-wrap tbody tr").count(),
        10,
        "Reviewing a lead does not mark first attention completed",
      );
      await page
        .getByRole("button", { name: "Embudo de ventas", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Buscar oportunidades" })
        .fill("busqueda-sin-coincidencias");
      await page
        .getByText("No hay oportunidades con esos filtros.", { exact: false })
        .waitFor();
      await page
        .getByRole("button", { name: "Limpiar filtros", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Ver oportunidades perdidas",
          exact: true,
        })
        .click();
      await page
        .getByRole("heading", { name: "Contacto descartado", exact: true })
        .waitFor();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar", exact: true }).click();
      const download = await downloadPromise;
      const csv = await readFile((await download.path())!, "utf8");
      assert.match(csv, /Contacto descartado/);
      assert.doesNotMatch(csv, /Hotel de prueba/);
      await page
        .getByRole("button", { name: "Ver embudo de ocho etapas", exact: true })
        .click();
      await audit("kanban");
      await page
        .getByRole("button", { name: "Ver etapas siguientes", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".kanban")!.scrollLeft > 100,
      );
      await page
        .getByRole("button", { name: "Ver etapas anteriores", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".kanban")!.scrollLeft === 0,
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: "/tmp/almo-crm-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(
        () =>
          document.querySelector(".sidebar")!.getBoundingClientRect().right <=
          0,
      );
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
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
      await page.getByRole("button", { name: "Resumen", exact: true }).click();
      await page
        .getByRole("heading", { name: "Panel comercial", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
      await audit("navegación móvil");
      await page
        .getByRole("button", { name: "Configurar etapas", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("heading").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") === "Abrir menú",
      );
      await audit("móvil");
      await page.screenshot({
        path: "/tmp/almo-crm-overview-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("button", { name: "Nueva oportunidad", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector(".page-heading > .primary"),
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Nueva oportunidad", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page.route("**/api/leads", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "No se pudieron consultar los contactos",
          }),
        }),
      );
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "No se pudo cargar la operación",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".sales-lead").count(), 0);
      assert.equal(await page.locator(".sales-results").count(), 0);
      await page.unroute("**/api/leads");
      await page
        .getByRole("button", { name: "Actualizar", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "A quién contactar", exact: true })
        .waitFor();
      const chooserPromise = page.waitForEvent("filechooser");
      await page
        .getByRole("button", { name: "Cambiar logo del negocio", exact: true })
        .click();
      const chooser = await chooserPromise;
      await chooser.setFiles({
        name: "logo.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      await page
        .getByRole("status")
        .filter({ hasText: "Logo guardado" })
        .waitFor();
      const brandImage = page.getByRole("img", {
        name: "Logo de Almojábanas Huilenses",
        exact: true,
      });
      await brandImage.evaluate((image) =>
        (image as HTMLImageElement).decode(),
      );
      assert.equal(
        await page
          .locator(".brand-copy, .profile, .workspace, .sidebar-focus")
          .count(),
        0,
      );
      const logoBounds = await brandImage.boundingBox();
      assert.ok(
        logoBounds && logoBounds.width === 128 && logoBounds.height === 128,
        "Sidebar logo is enlarged without stretching its original proportions",
      );
      assert.match(
        (await page.locator('link[rel="icon"]').getAttribute("href")) || "",
        /^\/api\/branding\/logo\?v=/,
      );
      await page.reload();
      await brandImage.waitFor();
      await brandImage.evaluate((image) =>
        (image as HTMLImageElement).decode(),
      );
      assert.equal(
        await brandImage.evaluate(
          (image) => (image as HTMLImageElement).naturalWidth,
        ),
        1,
      );
      await audit("logo guardado");
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
