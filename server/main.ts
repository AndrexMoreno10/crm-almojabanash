import { resolve } from "node:path";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT debe ser un puerto válido");
const { app, close, dispatchMessages } = createApp(
  process.env.CRM_DATABASE_PATH || "./data/crm.sqlite",
  resolve("dist"),
);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Almo CRM: servidor local iniciado en el puerto ${port}`),
);
const worker = setInterval(
  () =>
    void dispatchMessages().catch(() =>
      console.error("No se pudo procesar la cola de mensajes"),
    ),
  3000,
);
function shutdown() {
  clearInterval(worker);
  server.close(() => {
    close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
