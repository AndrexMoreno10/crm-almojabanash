import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

export async function ensureDependencies(root) {
  const hash = createHash("sha256")
    .update(readFileSync(join(root, "package-lock.json")))
    .update(readFileSync(join(root, "package.json")))
    .update(`${process.platform}:${process.arch}:${process.versions.modules}`)
    .digest("hex");
  const marker = join(root, "node_modules/.almo-dev-lock");
  if (
    existsSync(join(root, "node_modules/tsx/dist/cli.mjs")) &&
    existsSync(join(root, "node_modules/vite/bin/vite.js")) &&
    existsSync(marker) &&
    readFileSync(marker, "utf8") === hash
  )
    return false;
  console.log("[dependencias] Preparando las dependencias del proyecto…");
  const npmCli =
    process.env.npm_execpath ||
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  if (!existsSync(npmCli))
    throw new Error(
      "Inicia con npm run dev o npm run dev:sync para preparar las dependencias.",
    );
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        npmCli,
        "ci",
        "--no-fund",
        "--no-audit",
        "--cache",
        join(tmpdir(), "almo-npm-cache"),
      ],
      { cwd: root, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "No se pudieron preparar las dependencias. Revisa el error de npm.",
            ),
          ),
    );
  });
  writeFileSync(marker, hash);
  return true;
}
