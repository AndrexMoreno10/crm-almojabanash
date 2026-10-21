import express, { type Express } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

function imageType(data: Buffer): string | null {
  if (
    data.length >= 57 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR" &&
    data.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex"))
  ) {
    const width = data.readUInt32BE(16),
      height = data.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 4096 && height <= 4096
      ? "image/png"
      : null;
  }
  if (
    data.length >= 4 &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255 &&
    data[data.length - 2] === 255 &&
    data[data.length - 1] === 217
  )
    return "image/jpeg";
  if (
    data.length >= 16 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.readUInt32LE(4) === data.length - 8 &&
    data.toString("ascii", 8, 12) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16))
  )
    return "image/webp";
  return null;
}
export function installBranding(app: Express, db: DatabaseSync) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS brand_logo (id INTEGER PRIMARY KEY CHECK(id=1), mimeType TEXT NOT NULL, image BLOB NOT NULL, version TEXT NOT NULL)`,
  );
  const metadata = () => {
    const row = db
      .prepare("SELECT version FROM brand_logo WHERE id=1")
      .get() as { version: string } | undefined;
    return { logoUrl: row ? `/api/branding/logo?v=${row.version}` : null };
  };
  app.get("/api/branding", (_req, res) => res.json(metadata()));
  app.get("/api/branding/logo", (_req, res) => {
    const row = db
      .prepare("SELECT mimeType,image FROM brand_logo WHERE id=1")
      .get() as { mimeType: string; image: Uint8Array } | undefined;
    if (!row) {
      res.status(404).json({ error: "Todavía no se ha cargado un logo" });
      return;
    }
    res.type(row.mimeType).send(Buffer.from(row.image));
  });
  app.put(
    "/api/branding/logo",
    express.raw({
      type: ["image/png", "image/jpeg", "image/webp"],
      limit: "2mb",
    }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({
          error: "Selecciona un archivo PNG, JPG o WebP de hasta 2 MB",
        });
        return;
      }
      const mimeType = imageType(req.body);
      if (!mimeType || mimeType !== req.get("content-type")?.split(";")[0]) {
        res.status(400).json({
          error: "El archivo no es una imagen PNG, JPG o WebP válida",
        });
        return;
      }
      const version = createHash("sha256")
        .update(req.body)
        .digest("hex")
        .slice(0, 16);
      db.prepare(
        "INSERT INTO brand_logo(id,mimeType,image,version) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET mimeType=excluded.mimeType,image=excluded.image,version=excluded.version",
      ).run(mimeType, req.body, version);
      res.json(metadata());
    },
  );
}
