import test from "node:test";
import assert from "node:assert/strict";
import { complete, completeLine, remember, loadHistory, Recall } from "../src/client/readline.ts";

const known = ["resume", "napping", "top", "privacy", "contact", "help", "ls", "cd", "cat", "pwd", "clear", "exit", "sudo"];

test("Tab with one match completes the word and a space", () => {
  assert.deepEqual(complete("con", known), { line: "contact ", list: [] });
});

test("Tab with several matches keeps the line and lists them", () => {
  assert.deepEqual(complete("c", known), { line: "c", list: ["cat", "cd", "clear", "contact"] });
});

test("Tab extends to the shared prefix", () => {
  assert.deepEqual(complete("he", ["help", "hello"]), { line: "hel", list: ["hello", "help"] });
});

test("Tab with no match changes nothing", () => {
  assert.deepEqual(complete("zz", known), { line: "zz", list: [] });
});

test("Tab on an empty line lists every command", () => {
  assert.deepEqual(complete("", known), { line: "", list: [...known].sort() });
});

test("Tab only completes the first word", () => {
  assert.deepEqual(complete("sudo w", known), { line: "sudo w", list: [] });
});

test("history skips repeats, leading-space lines and blanks, and keeps the newest max", () => {
  let h: string[] = [];
  for (const l of ["help", "help", " secret", "", "ls", "help"]) h = remember(h, l);
  assert.deepEqual(h, ["help", "ls", "help"]);
  let big: string[] = [];
  for (let i = 0; i < 105; i++) big = remember(big, `c${i}`);
  assert.equal(big.length, 100);
  assert.equal(big[0], "c5");
  assert.equal(remember(["a"], "b", 1).join(), "b");
});

test("stored history is parsed tolerantly", () => {
  assert.deepEqual(loadHistory(null), []);
  assert.deepEqual(loadHistory("x"), []);
  assert.deepEqual(loadHistory("{}"), []);
  assert.deepEqual(loadHistory('[1,"a"]'), ["a"]);
});

test("up and down walk the history and give the draft back", () => {
  const r = new Recall(["one", "two"]);
  assert.equal(r.up("dra"), "two");
  assert.equal(r.up("ignored"), "one");
  assert.equal(r.up("ignored"), "one", "up at the oldest stays");
  assert.equal(r.down(), "two");
  assert.equal(r.down(), "dra", "down past the newest restores the draft");
  assert.equal(r.down(), "dra");
  assert.equal(new Recall([]).up("x"), "x");
});

test("Tab after cd, cat or ls completes a path; elsewhere it completes the command", () => {
  const paths = (p: string) => ["ops/", "other/"].filter((x) => x.startsWith(p));
  assert.deepEqual(completeLine("cd o", known, paths), { line: "cd o", list: ["ops/", "other/"] });
  assert.deepEqual(completeLine("cat op", known, paths), { line: "cat ops/", list: [] });
  assert.deepEqual(completeLine("ls zz", known, paths), { line: "ls zz", list: [] });
  assert.deepEqual(completeLine("con", known, paths), complete("con", known));
  assert.deepEqual(completeLine("sudo o", known, paths), { line: "sudo o", list: [] }, "only file commands take paths");
  const file = (p: string) => ["ops/certs.md"].filter((x) => x.startsWith(p));
  assert.deepEqual(completeLine("cat ops/c", known, file), { line: "cat ops/certs.md ", list: [] }, "a file ends the word");
});

test("review: Tab keeps completing a path that already has a space in it", () => {
  const paths = (p: string) => ["ops/My Writeup.md"].filter((x) => x.startsWith(p));
  assert.deepEqual(completeLine("cat ops/My W", known, paths), { line: "cat ops/My Writeup.md ", list: [] });
});
