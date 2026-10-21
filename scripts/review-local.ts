import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createApp } from "../server/app.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const webDirectory = resolve(root, "dist");
if (!existsSync(resolve(webDirectory, "index.html"))) {
  console.error("Primero ejecuta npm run build para preparar la interfaz.");
  process.exit(1);
}
const port = Number(process.env.CRM_REVIEW_PORT || 0);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("CRM_REVIEW_PORT debe ser un puerto válido");
// Revisión local sin credenciales ni envíos de Meta. Conserva la base existente.
const { app, close } = createApp(
  process.env.CRM_DATABASE_PATH || resolve(root, "data/crm.sqlite"),
  webDirectory,
  {},
);
const server = app.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") return;
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`Almo CRM · revisión local: ${url}`);
  console.log(
    "Mantén esta ventana abierta. Para detener, pulsa Ctrl+C. Los datos se conservan; Meta está desactivado.",
  );
  if (process.platform === "win32" && !process.argv.includes("--no-open")) {
    const opener = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      stdio: "ignore",
      detached: true,
    });
    opener.on("error", () => console.log(`Abre el navegador en ${url}`));
    opener.unref();
  }
});
server.on("error", (error) => {
  console.error(`No pudimos iniciar el CRM: ${error.message}`);
  close();
  process.exit(1);
});
function shutdown() {
  server.close(() => {
    close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
