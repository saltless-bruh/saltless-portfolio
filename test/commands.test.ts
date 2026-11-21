import test from "node:test";
import assert from "node:assert/strict";
import { run, distance, nearest, type Cfg, type Outcome } from "../src/client/commands.ts";
import type { Node } from "../src/client/fs.ts";
import { loadContent } from "../src/content.ts";

const f = (href: string): Node => ({ dir: false, href });
const fs: Node = { dir: true, kids: { ops: { dir: true, kids: {
  reports: { dir: true, kids: { "blogcms.md": f("/ops/reports/blogcms") } },
  writeups: { dir: true, kids: {} },
  "certs.md": f("/ops/certs"),
  "My Writeup.md": f("/ops/my-writeup"),
} } } };
const cfg: Cfg = {
  screens: [{ cmd: "resume", blurb: "" }], notFound: "too lazy", sudo: ["no", "shame"], hint: "", back: "q / Esc · back", inputCol: 4,
  fs, emptyNote: "(empty. writeups are being collected.)", home: "~/saltless-bruh",
  filesHelp: { cmd: "ls · cd · cat", blurb: "the offense work, as files. start with: cd ops" },
};
const text = (o: Outcome): string => (o.kind === "rows" ? o.rows.map((r) => r.runs.map((x) => x.text).join(" ")).join("\n") : "");

test("an unknown command fails with 127, in zsh's words", () => {
  const out = run("nope", cfg);
  assert.equal(out.kind, "rows");
  if (out.kind !== "rows") return;
  assert.equal(out.status, 127);
  assert.equal(out.rows[0]!.runs[0]!.text, "zsh: command not found: nope");
});

test("sudo is refused with 1, and an ordinary command succeeds", () => {
  const s = run("sudo rm", cfg);
  assert.ok(s.kind === "rows" && s.status === 1);
  const l = run("ls", cfg);
  assert.ok(l.kind === "rows" && l.status === 0);
});

const KNOWN = ["resume", "napping", "privacy", "contact", "help", "ls", "cd", "cat", "pwd", "clear", "exit", "sudo"];

test("a swapped pair of letters is one edit, as zsh's spell checker treats it", () => {
  assert.equal(distance("hepl", "help"), 1);
  assert.equal(distance("sl", "ls"), 1);
  assert.equal(distance("nope", "top"), 2);
});

test("corrections catch real typos and leave unrelated words alone", () => {
  for (const [typo, meant] of [["hepl", "help"], ["hlep", "help"], ["sl", "ls"], ["claer", "clear"], ["exti", "exit"], ["napipng", "napping"], ["contcat", "contact"], ["lss", "ls"], ["privcay", "privacy"]]) {
    assert.equal(nearest(typo, KNOWN), meant, typo);
  }
  for (const word of ["nope", "who", "xyz", "cat", "rm"]) assert.equal(nearest(word, KNOWN), undefined, `${word} was "corrected"`);
});

test("whoami is gone from the shell: one line about the owner lives elsewhere", () => {
  const w = run("whoami", cfg);
  assert.ok(w.kind === "rows" && w.status === 127);
});

test("ls lists files, not pages: home has ops/, and an empty folder says so", () => {
  assert.equal(text(run("ls", cfg)), "ops/");
  assert.match(text(run("ls ops", cfg)), /reports\/\s+writeups\/\s+My Writeup.md/);
  assert.equal(text(run("ls", cfg, ["ops", "writeups"])), "(empty. writeups are being collected.)");
  const bad = run("ls nope", cfg);
  assert.ok(bad.kind === "rows" && bad.status === 2);
});

test("cd changes the working directory and reports failures in zsh's words", () => {
  const ok = run("cd ops", cfg);
  assert.ok(ok.kind === "rows" && ok.status === 0);
  if (ok.kind === "rows") assert.deepEqual(ok.cwd, ["ops"]);
  assert.equal(text(run("cd nope", cfg)), "cd: no such file or directory: nope");
  const home = run("cd", cfg, ["ops"]);
  if (home.kind === "rows") assert.deepEqual(home.cwd, []);
});

test("cat opens the reader, from wherever you are", () => {
  assert.deepEqual(run("cat ops/certs.md", cfg), { kind: "go", to: "/ops/certs" });
  assert.deepEqual(run("cat reports/blogcms.md", cfg, ["ops"]), { kind: "go", to: "/ops/reports/blogcms" });
  assert.equal(text(run("cat ops", cfg)), "cat: ops: Is a directory");
});

test("pwd prints where you are, from the prompt's own home", () => {
  assert.equal(text(run("pwd", cfg, ["ops", "writeups"])), "~/saltless-bruh/ops/writeups");
});

test("the findings page is gone: its contents live in ops/", () => {
  assert.ok(!loadContent().screens.some((s) => s.cmd === "findings"));
});

test("review: a file name with spaces opens from the shell", () => {
  assert.deepEqual(run("cat ops/My Writeup.md", cfg), { kind: "go", to: "/ops/my-writeup" });
});

test("review: help points visitors at the files", () => {
  assert.match(text(run("help", cfg)), /ls · cd · cat\s+the offense work, as files/);
});

test("minor 9: ls never runs past 40 columns", () => {
  const wide: Cfg = { ...cfg, fs: { dir: true, kids: Object.fromEntries(
    ["a-rather-long-writeup-name.md", "another-long-writeup-name.md", "third-long-writeup-name.md", "x.md"].map((n) => [n, { dir: false as const, href: "/x" }])) } };
  const out = run("ls", wide);
  assert.ok(out.kind === "rows");
  if (out.kind === "rows") for (const r of out.rows) for (const x of r.runs) assert.ok(x.col + x.text.length <= 40, `${x.text} ends at ${x.col + x.text.length}`);
});

test("help ends with the way back, since no page shows a menu", () => {
  const out = run("help", cfg);
  assert.equal(out.kind, "rows");
  if (out.kind !== "rows") return;
  const last = out.rows.at(-1)!;
  assert.deepEqual(last.runs.map((r) => [r.text, r.style]), [["q / Esc · back", "muted"]]);
});
