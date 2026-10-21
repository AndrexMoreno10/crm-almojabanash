import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const git = async (root, args) =>
  (
    await execute("git", args, {
      cwd: root,
      timeout: 25000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    })
  ).stdout.trim();

export async function syncRepository(root, beforeUpdate = async () => {}) {
  const branch = await git(root, ["branch", "--show-current"]);
  if (branch !== "main") return { kind: "branch" };
  if (await git(root, ["status", "--porcelain"])) return { kind: "dirty" };
  const head = await git(root, ["rev-parse", "HEAD"]);
  await git(root, ["fetch", "origin", "main"]);
  const target = await git(root, ["rev-parse", "FETCH_HEAD"]);
  if (head === target) return { kind: "current" };
  try {
    await git(root, ["merge-base", "--is-ancestor", head, target]);
  } catch (error) {
    if (error.code === 1) return { kind: "diverged" };
    throw error;
  }
  if (await git(root, ["status", "--porcelain"])) return { kind: "dirty" };
  const files = (await git(root, ["diff", "--name-only", head, target])).split(
    "\n",
  );
  const dependenciesChanged = files.some((file) =>
    ["package.json", "package-lock.json", ".npmrc", ".nvmrc"].includes(file),
  );
  await beforeUpdate({ dependenciesChanged });
  // Recheck after any service shutdown; never overwrite local work or merge commits automatically.
  if ((await git(root, ["branch", "--show-current"])) !== "main")
    return { kind: "branch" };
  if (
    (await git(root, ["status", "--porcelain"])) ||
    (await git(root, ["rev-parse", "HEAD"])) !== head
  )
    return { kind: "dirty" };
  try {
    await git(root, ["merge", "--ff-only", "--no-overwrite-ignore", target]);
  } catch (error) {
    if (error.code === 1) return { kind: "blocked" };
    throw error;
  }
  return { kind: "updated", dependenciesChanged, commit: target };
}
