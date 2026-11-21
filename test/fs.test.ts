import test from "node:test";
import assert from "node:assert/strict";
import { resolve, ls, cd, cat, completePath, displayPath, validCwd, fitPath, type Node } from "../src/client/fs.ts";

const f = (href: string): Node => ({ dir: false, href });
const tree: Node = { dir: true, kids: {
  ops: { dir: true, kids: {
    reports: { dir: true, kids: { "blogcms.md": f("/ops/reports/blogcms") } },
    writeups: { dir: true, kids: {} },
    tools: { dir: true, kids: { "saltpilot.md": f("/ops/tools/saltpilot"), "csrf-shield-ai.md": f("/ops/tools/csrf-shield-ai") } },
    "certs.md": f("/ops/certs"),
  } },
} };
const EMPTY = "(empty. writeups are being collected.)";

test("paths resolve from the working directory, from ~, and never above ~", () => {
  assert.deepEqual(resolve(tree, [], "ops/reports"), ["ops", "reports"]);
  assert.deepEqual(resolve(tree, ["ops"], "reports/"), ["ops", "reports"]);
  assert.deepEqual(resolve(tree, ["ops", "reports"], ".."), ["ops"]);
  assert.deepEqual(resolve(tree, ["ops", "reports"], "~"), []);
  assert.deepEqual(resolve(tree, ["ops"], "~/ops/tools"), ["ops", "tools"]);
  assert.deepEqual(resolve(tree, ["ops"], "../../../.."), [], "nothing above home");
  assert.deepEqual(resolve(tree, [], "./ops/./certs.md"), ["ops", "certs.md"]);
  assert.equal(resolve(tree, [], "nope"), null);
  assert.equal(resolve(tree, [], "/etc/passwd"), null, "no root outside home");
  assert.equal(resolve(tree, ["ops"], "../../etc/passwd"), null);
});

test("ls lists a directory, folders first and marked, and says when one is empty", () => {
  assert.deepEqual(ls(tree, [], undefined, EMPTY), { entries: ["ops/"], status: 0 });
  assert.deepEqual(ls(tree, ["ops"], undefined, EMPTY), { entries: ["reports/", "tools/", "writeups/", "certs.md"], status: 0 });
  assert.deepEqual(ls(tree, ["ops"], "writeups", EMPTY), { entries: [], note: EMPTY, status: 0 });
  assert.deepEqual(ls(tree, [], "ops/certs.md", EMPTY), { entries: ["ops/certs.md"], status: 0 });
  assert.deepEqual(ls(tree, [], "nope", EMPTY), { entries: [], error: "ls: cannot access 'nope': No such file or directory", status: 2 });
});

test("cd moves, refuses files and missing paths in zsh's words, and goes home with no argument", () => {
  assert.deepEqual(cd(tree, [], "ops"), { cwd: ["ops"], status: 0 });
  assert.deepEqual(cd(tree, ["ops"], undefined), { cwd: [], status: 0 });
  assert.deepEqual(cd(tree, ["ops"], "certs.md"), { error: "cd: not a directory: certs.md", status: 1 });
  assert.deepEqual(cd(tree, [], "nope"), { error: "cd: no such file or directory: nope", status: 1 });
});

test("cat opens a file in the reader, and refuses directories and missing files", () => {
  assert.deepEqual(cat(tree, ["ops"], "reports/blogcms.md"), { go: "/ops/reports/blogcms", status: 0 });
  assert.deepEqual(cat(tree, [], "ops"), { error: "cat: ops: Is a directory", status: 1 });
  assert.deepEqual(cat(tree, [], "nope.md"), { error: "cat: nope.md: No such file or directory", status: 1 });
  assert.deepEqual(cat(tree, [], undefined), { error: "cat: missing file operand", status: 1 });
});

test("Tab completes paths, adding / to folders", () => {
  assert.deepEqual(completePath(tree, [], "o"), ["ops/"]);
  assert.deepEqual(completePath(tree, [], "ops/r"), ["ops/reports/"]);
  assert.deepEqual(completePath(tree, ["ops"], "t"), ["tools/"]);
  assert.deepEqual(completePath(tree, ["ops"], "tools/"), ["tools/csrf-shield-ai.md", "tools/saltpilot.md"]);
  assert.deepEqual(completePath(tree, ["ops"], "c"), ["certs.md"]);
  assert.deepEqual(completePath(tree, [], "zz"), []);
});

test("the prompt shows where you are", () => {
  assert.equal(displayPath([]), "~");
  assert.equal(displayPath(["ops", "writeups"]), "~/ops/writeups");
});

test("minor 4: a stored working directory that is a file, or gone, falls back home", () => {
  assert.deepEqual(validCwd(tree, ["ops", "certs.md"]), []);
  assert.deepEqual(validCwd(tree, ["ops", "gone"]), []);
  assert.deepEqual(validCwd(tree, ["ops", "reports"]), ["ops", "reports"]);
});

test("minor 9: a deep path shortens to fit the prompt, keeping its end", () => {
  assert.equal(fitPath("~/saltless-bruh", ["ops"], 40), "~/saltless-bruh/ops");
  const deep = fitPath("~/saltless-bruh", ["ops", "writeups", "a-very-long-folder-name", "x"], 22);
  assert.ok([...deep].length <= 22, deep);
  assert.ok(deep.startsWith("~/…/") && deep.endsWith("/x"), deep);
});
