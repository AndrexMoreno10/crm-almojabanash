import type { DatabaseSync } from "node:sqlite";
import { defaultLabels, type Settings, type Stage } from "../shared/types.ts";

// Mantiene IDs, leads, notas y etiquetas personalizadas al ampliar el embudo.
export function migratePipelineSettings(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)",
  );
  const name = "eight_stage_pipeline_v1";
  if (db.prepare("SELECT name FROM schema_migrations WHERE name=?").get(name))
    return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT data FROM settings WHERE id=1").get() as {
      data: string;
    };
    const before = JSON.parse(row.data) as Settings;
    const stageLabels = { ...defaultLabels, ...before.stageLabels };
    const legacyLabels: Partial<Record<Stage, string>> = {
      new: "Nuevo contacto",
      conversation: "En conversación",
      proposal: "Propuesta enviada",
      won: "Venta ganada",
      lost: "Venta perdida",
    };
    for (const [key, oldLabel] of Object.entries(legacyLabels)) {
      const stage = key as Stage;
      if (stageLabels[stage] === oldLabel)
        stageLabels[stage] = defaultLabels[stage];
    }
    db.prepare("UPDATE settings SET data=? WHERE id=1").run(
      JSON.stringify({ ...before, stageLabels }),
    );
    db.prepare(
      "INSERT INTO schema_migrations (name,appliedAt) VALUES (?,?)",
    ).run(name, new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
