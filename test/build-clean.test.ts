import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { emptyDir } from "../src/build.ts";

test("the build starts from an empty output folder, so a removed writeup cannot be deployed", () => {
  const root = mkdtempSync(join(tmpdir(), "dist-"));
  mkdirSync(join(root, "ops", "writeups", "pulled"), { recursive: true });
  writeFileSync(join(root, "ops", "writeups", "pulled", "index.html"), "old page");
  writeFileSync(join(root, "chunk-OLD.js"), "old chunk");
  emptyDir(pathToFileURL(root + "/"));
  assert.ok(existsSync(root), "the folder itself stays, so a server pointed at it keeps working");
  assert.deepEqual(readdirSync(root), []);
});
