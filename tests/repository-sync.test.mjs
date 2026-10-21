import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { syncRepository } from "../scripts/repository-sync.mjs";
const git = (root, ...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "almo-git-sync-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, "remote.git");
  const author = join(root, "author");
  const local = join(root, "local");
  git(root, "init", "--bare", remote);
  git(root, "init", "--initial-branch=main", author);
  git(author, "config", "user.name", "Fixture");
  git(author, "config", "user.email", "fixture@example.test");
  writeFileSync(join(author, "contact.txt"), "original\n");
  writeFileSync(
    join(author, "package.json"),
    '{"name":"fixture","version":"1.0.0"}\n',
  );
  git(author, "add", ".");
  git(author, "commit", "-m", "initial");
  git(author, "remote", "add", "origin", remote);
  git(author, "push", "origin", "main");
  git(root, "clone", "--branch", "main", remote, local);
  git(local, "config", "user.name", "Fixture");
  git(local, "config", "user.email", "fixture@example.test");
  const publish = (file, content) => {
    writeFileSync(join(author, file), content);
    git(author, "add", file);
    git(author, "commit", "-m", "update");
    git(author, "push", "origin", "main");
  };
  return { local, author, publish };
}
test("automatic sync fast-forwards a clean copy and detects when it is already current", async (t) => {
  const { local, publish } = fixture(t);
  publish("contact.txt", "remote update\n");
  let before = 0;
  const result = await syncRepository(local, async (plan) => {
    before++;
    assert.equal(plan.dependenciesChanged, false);
  });
  assert.equal(result.kind, "updated");
  assert.equal(before, 1);
  assert.equal(
    readFileSync(join(local, "contact.txt"), "utf8"),
    "remote update\n",
  );
  assert.equal((await syncRepository(local)).kind, "current");
});
test("automatic sync identifies dependency changes before updating the checkout", async (t) => {
  const { local, publish } = fixture(t);
  publish("package.json", '{"name":"fixture","version":"2.0.0"}\n');
  let paused = false;
  const result = await syncRepository(local, async (plan) => {
    paused = plan.dependenciesChanged;
    assert.match(readFileSync(join(local, "package.json"), "utf8"), /1.0.0/);
  });
  assert.equal(result.kind, "updated");
  assert.equal(result.dependenciesChanged, true);
  assert.equal(paused, true);
  assert.match(readFileSync(join(local, "package.json"), "utf8"), /2.0.0/);
});
test("automatic sync preserves tracked and untracked local work and rechecks before a merge", async (t) => {
  const { local, publish } = fixture(t);
  const head = git(local, "rev-parse", "HEAD");
  publish("contact.txt", "remote\n");
  writeFileSync(join(local, "contact.txt"), "local customer work\n");
  assert.equal((await syncRepository(local)).kind, "dirty");
  assert.equal(
    readFileSync(join(local, "contact.txt"), "utf8"),
    "local customer work\n",
  );
  git(local, "restore", "contact.txt");
  writeFileSync(join(local, "draft.txt"), "local draft");
  assert.equal((await syncRepository(local)).kind, "dirty");
  rmSync(join(local, "draft.txt"));
  const result = await syncRepository(local, async () =>
    writeFileSync(join(local, "contact.txt"), "edit while updating\n"),
  );
  assert.equal(result.kind, "dirty");
  assert.equal(git(local, "rev-parse", "HEAD"), head);
  assert.equal(
    readFileSync(join(local, "contact.txt"), "utf8"),
    "edit while updating\n",
  );
  git(local, "restore", "contact.txt");
  const switched = await syncRepository(local, async () => {
    git(local, "switch", "-c", "new-work");
  });
  assert.equal(switched.kind, "branch");
  assert.equal(git(local, "rev-parse", "HEAD"), head);
  assert.equal(git(local, "branch", "--show-current"), "new-work");
});
test("automatic sync never resets a diverged branch or changes the active branch", async (t) => {
  const { local, publish } = fixture(t);
  writeFileSync(join(local, "my-work.txt"), "local commit");
  git(local, "add", "my-work.txt");
  git(local, "commit", "-m", "local work");
  const head = git(local, "rev-parse", "HEAD");
  publish("contact.txt", "remote\n");
  assert.equal((await syncRepository(local)).kind, "diverged");
  assert.equal(git(local, "rev-parse", "HEAD"), head);
  git(local, "switch", "-c", "my-feature");
  assert.equal((await syncRepository(local)).kind, "branch");
  assert.equal(git(local, "branch", "--show-current"), "my-feature");
});

test("automatic sync preserves ignored local files even when the remote begins tracking their path", async (t) => {
  const { local, author, publish } = fixture(t);
  publish(".gitignore", "private.txt\n");
  await syncRepository(local);
  const head = git(local, "rev-parse", "HEAD");
  writeFileSync(join(local, "private.txt"), "local customer data\n");
  assert.equal(git(local, "status", "--porcelain"), "");
  // A remote commit may start tracking a previously ignored path.
  writeFileSync(join(author, "private.txt"), "remote content\n");
  git(author, "add", "--force", "private.txt");
  git(author, "commit", "-m", "track ignored path");
  git(author, "push", "origin", "main");
  assert.equal((await syncRepository(local)).kind, "blocked");
  assert.equal(
    readFileSync(join(local, "private.txt"), "utf8"),
    "local customer data\n",
  );
  assert.equal(git(local, "rev-parse", "HEAD"), head);
});
