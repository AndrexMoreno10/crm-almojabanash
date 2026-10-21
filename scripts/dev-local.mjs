import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createServer } from "node:net";
import { syncRepository } from "./repository-sync.mjs";
import { ensureDependencies } from "./dev-dependencies.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const withSync = process.argv.includes("--sync");
let children = [];
let stopping = false;
let exiting = false;
let syncing = false;
let opened = false;
let lastNotice = "";
let timer;
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
function notice(message) {
  if (lastNotice !== message) {
    console.log(message);
    lastNotice = message;
  }
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `El puerto ${port} está ocupado. Cierra la sesión anterior del CRM antes de iniciar otra.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
async function stopDev() {
  stopping = true;
  const owned = children;
  children = [];
  await Promise.all(
    owned.map(async (child) => {
      if (child.exitCode !== null || !child.pid) return;
      const exited = new Promise((resolve) => child.once("exit", resolve));
      if (process.platform === "win32")
        await new Promise((resolve) =>
          execFile(
            "taskkill.exe",
            ["/pid", String(child.pid), "/t", "/f"],
            () => resolve(),
          ),
        );
      else {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {}
      }
      await Promise.race([exited, wait(4000)]);
      if (child.exitCode === null && process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }
    }),
  );
  stopping = false;
}
function run(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, PORT: "3001", META_SEND_ENABLED: "false" },
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  children.push(child);
  child.on("error", (error) => void fatal(error));
  child.on("exit", (code) => {
    if (!stopping && !exiting)
      void fatal(
        new Error(
          `Un servicio se detuvo (${code ?? "señal"}). Revisa el mensaje anterior.`,
        ),
      );
  });
  return child;
}
async function startDev() {
  await freePort(3001);
  await freePort(5173);
  const api = run([
    join(root, "node_modules/tsx/dist/cli.mjs"),
    "watch",
    "server/main.ts",
  ]);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (exiting || api.exitCode !== null)
      throw new Error("No se pudo iniciar la API.");
    try {
      const response = await fetch("http://127.0.0.1:3001/api/health");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await wait(200);
  }
  if (!ready) throw new Error("La API no terminó de iniciar.");
  const args = [
    join(root, "node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
  ];
  if (
    !opened &&
    process.platform === "win32" &&
    !process.argv.includes("--no-open")
  )
    args.push("--open");
  run(args);
  opened = true;
  console.log(
    "[desarrollo] Interfaz y servidor se actualizan al guardar. No hace falta ejecutar build. Meta está desactivado.",
  );
}
async function poll() {
  if (syncing || exiting) return;
  syncing = true;
  let paused = false;
  try {
    const result = await syncRepository(
      root,
      async ({ dependenciesChanged }) => {
        if (dependenciesChanged) {
          paused = true;
          console.log("[actualización] Preparando nuevas dependencias…");
          await stopDev();
        }
      },
    );
    if (result.kind === "updated") {
      if (result.dependenciesChanged) await ensureDependencies(root);
      notice(
        `[actualización] Código actualizado a ${result.commit.slice(0, 7)}. El navegador recibirá los cambios automáticamente.`,
      );
    } else if (result.kind === "dirty")
      notice(
        "[actualización] Pausada: hay cambios locales. Tu trabajo se conserva. Se reanudará cuando el repositorio esté limpio.",
      );
    else if (result.kind === "branch")
      notice(
        "[actualización] Pausada: esta opción sincroniza la rama main. No se cambiará tu rama actual.",
      );
    else if (result.kind === "diverged")
      notice(
        "[actualización] Pausada: el historial local y GitHub difieren. No se harán resets ni se sobrescribirán commits.",
      );
    else if (result.kind === "blocked")
      notice(
        "[actualización] Pausada: Git no puede aplicar la actualización sin afectar archivos locales. Tus archivos se conservan; revisa el repositorio.",
      );
    else
      notice(
        "[actualización] Código al día. Revisando GitHub cada 20 segundos.",
      );
    if (paused && !exiting) await startDev();
  } catch (error) {
    if (paused) {
      await fatal(error);
      return;
    }
    notice(
      "[actualización] No se pudo consultar GitHub. El CRM sigue funcionando con la copia local; revisa la conexión y el acceso de Git.",
    );
  } finally {
    syncing = false;
  }
}
async function fatal(error) {
  if (exiting) return;
  exiting = true;
  clearInterval(timer);
  console.error(`[desarrollo] ${error.message}`);
  await stopDev();
  process.exit(1);
}
async function shutdown() {
  if (exiting) return;
  exiting = true;
  clearInterval(timer);
  await stopDev();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
try {
  await ensureDependencies(root);
  await startDev();
  if (withSync) {
    await poll();
    timer = setInterval(() => void poll(), 20000);
  }
} catch (error) {
  await fatal(error);
}
