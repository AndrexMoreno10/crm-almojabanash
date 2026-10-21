import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import { createApp } from "../server/app.ts";

test(
  "inventory browser: editable catalog, initial count, sale, low stock, history, archive and mobile",
  { timeout: 240000 },
  async () => {
    const instance = createApp(":memory:", resolve("dist"), {});
    const server = await new Promise<import("node:http").Server>((resolve) => {
      const server = instance.app.listen(0, "127.0.0.1", () => resolve(server));
    });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}`;
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
      const audit = async (name: string) => {
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          result.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          })),
          [],
          name,
        );
      };
      await page.goto(`${base}/#inventory`);
      await page
        .getByRole("heading", { name: "Inventario", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Almojábana", exact: true })
        .waitFor();
      assert.equal(
        await page
          .locator(".sidebar")
          .getByRole("button", { name: "Seguimientos", exact: true })
          .count(),
        0,
      );
      assert.equal(await page.locator(".inventory-table tbody tr").count(), 40);
      const productRow = () =>
        page.locator(".inventory-table tbody tr").filter({
          has: page.getByRole("button", { name: "Almojábana", exact: true }),
        });
      assert.match((await productRow().textContent()) || "", /Sin registrar/);
      assert.equal(
        await productRow().getByText("Por definir", { exact: true }).count(),
        2,
      );
      await audit("catálogo inicial");
      await page.screenshot({
        path: "/tmp/almo-inventory-catalog.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Almojábana", exact: true })
        .click();
      await page
        .getByLabel("Unidad de control", { exact: true })
        .fill("unidad");
      await page.getByLabel("Moneda", { exact: true }).selectOption("COP");
      await page.getByLabel("Precio al detal", { exact: true }).fill("2000");
      await page.getByLabel("Precio mayorista", { exact: true }).fill("1500");
      await page.getByLabel("Existencia mínima", { exact: true }).fill("10");
      await audit("edición de producto");
      await page
        .getByRole("button", { name: "Guardar producto", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await productRow().getByText("Sin registrar", { exact: false }).waitFor();
      await productRow()
        .getByRole("button", {
          name: "Registrar movimiento de Almojábana",
          exact: true,
        })
        .click();
      assert.equal(
        await page
          .getByLabel("Tipo de movimiento", { exact: true })
          .inputValue(),
        "opening",
      );
      await page.getByLabel("Cantidad (unidad)", { exact: true }).fill("25");
      await page
        .getByLabel("Motivo del movimiento", { exact: true })
        .fill("Conteo inicial de prueba");
      await audit("registro de movimiento");
      await page
        .getByRole("button", { name: "Guardar movimiento", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await productRow()
        .locator(".inventory-quantity")
        .filter({ hasText: "25" })
        .waitFor();
      await productRow()
        .getByRole("button", {
          name: "Registrar movimiento de Almojábana",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Tipo de movimiento", { exact: true })
        .selectOption("sale");
      await page.getByLabel("Cantidad (unidad)", { exact: true }).fill("30");
      await page
        .getByLabel("Motivo del movimiento", { exact: true })
        .fill("Venta registrada en prueba");
      assert.equal(
        await page
          .getByRole("button", { name: "Guardar movimiento", exact: true })
          .isDisabled(),
        true,
      );
      await page.getByLabel("Cantidad (unidad)", { exact: true }).fill("20");
      await page
        .getByRole("button", { name: "Guardar movimiento", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await productRow().getByText("Stock bajo", { exact: true }).waitFor();
      assert.match(
        (await productRow().locator(".inventory-quantity").textContent()) || "",
        /^5\s/,
      );
      await page.getByRole("tab", { name: "Movimientos", exact: true }).click();
      await page
        .getByText("Venta registrada en prueba", { exact: true })
        .waitFor();
      assert.equal(await page.locator(".inventory-table tbody tr").count(), 2);
      await audit("historial de movimientos");
      await page.screenshot({
        path: "/tmp/almo-inventory-movements.png",
        fullPage: true,
      });
      await page.reload();
      await productRow().getByText("Stock bajo", { exact: true }).waitFor();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Exportar inventario", exact: true })
        .click();
      assert.equal((await download).suggestedFilename(), "inventario.csv");
      await page
        .getByRole("button", { name: "Nuevo producto", exact: true })
        .click();
      await page
        .getByLabel("Nombre del producto", { exact: true })
        .fill("Producto adicional de prueba");
      await page
        .getByLabel("Presentación", { exact: true })
        .fill("Botella de prueba");
      await page
        .getByLabel("Unidad de control", { exact: true })
        .fill("botella");
      await page
        .getByRole("button", { name: "Guardar producto", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page
        .getByRole("button", {
          name: "Archivar Producto adicional de prueba Botella de prueba",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Archivar producto", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByLabel("Archivados", { exact: true }).check();
      await page
        .getByRole("button", { name: "Reactivar", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Reactivar producto", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByLabel("Archivados", { exact: true }).uncheck();
      await page
        .getByRole("button", {
          name: "Producto adicional de prueba",
          exact: true,
        })
        .waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Inventario debe caber en móvil",
      );
      await audit("inventario móvil");
      await page.screenshot({
        path: "/tmp/almo-inventory-mobile.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Nuevo producto", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      instance.close();
    }
  },
);
