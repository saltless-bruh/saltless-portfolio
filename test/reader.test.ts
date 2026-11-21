import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readOps, homeTree } from "../src/ops.ts";
import { renderDoc } from "../src/reader.ts";

function fixture(): URL {
  const root = mkdtempSync(join(tmpdir(), "ops-"));
  mkdirSync(join(root, "writeups"));
  mkdirSync(join(root, "labs"));
  writeFileSync(join(root, "writeups", "My Writeup.md"), "# Mine\n\nsee [[certs]] and [[nowhere|a ghost]]\n\n![shot](shot.png)\n");
  writeFileSync(join(root, "writeups", "shot.png"), "png");
  writeFileSync(join(root, "certs.md"), "# Certs\n");
  writeFileSync(join(root, "notes.txt"), "not markdown");
  return pathToFileURL(root + "/");
}

test("the tree holds Markdown files and folders, nothing else, with linkable addresses", () => {
  const { tree, docs } = readOps(fixture());
  assert.ok(tree.dir);
  if (!tree.dir) return;
  assert.deepEqual(Object.keys(tree.kids).sort(), ["certs.md", "labs", "writeups"], "notes.txt is not part of it");
  const ws = tree.kids.writeups!;
  assert.ok(ws.dir && !("shot.png" in ws.kids), "images are assets, not files to ls");
  const mine = docs.find((d) => d.path.at(-1) === "My Writeup.md")!;
  assert.equal(mine.href, "/ops/writeups/my-writeup", "spaces and capitals become a clean address");
  assert.equal(mine.title, "Mine", "the first heading is the title");
});

test("Obsidian callouts become callout boxes", () => {
  const html = renderDoc("> [!danger] Unauthenticated to RCE\n> step one\n", { dir: [], links: {} });
  assert.match(html, /<aside class="callout callout-danger">/);
  assert.match(html, /Unauthenticated to RCE/);
  assert.ok(!html.includes("[!danger]"));
});

test("wikilinks link to files that exist and stay plain text when they do not", () => {
  const html = renderDoc("see [[certs]] and [[nowhere|a ghost]]", { dir: [], links: { certs: "/ops/certs" } });
  assert.match(html, /<a href="\/ops\/certs">certs<\/a>/);
  assert.ok(html.includes("a ghost") && !html.includes("nowhere"), "a missing target keeps its label and drops the brackets");
  assert.equal((html.match(/<a /g) || []).length, 1);
});

test("code blocks carry their language as a label", () => {
  const html = renderDoc("```python\nprint(1)\n```\n", { dir: [], links: {} });
  assert.match(html, /<figure class="md-code"><figcaption>python<\/figcaption><pre><code>print\(1\)/);
});

test("relative images point at the copy the build puts beside the reader", () => {
  const html = renderDoc("![shot](shot.png) ![web](https://example.com/x.png)", { dir: ["writeups"], links: {} });
  assert.match(html, /src="\/ops\/writeups\/shot.png"/);
  assert.match(html, /src="https:\/\/example.com\/x.png"/);
});

/**
 * Names from the lab's own source, as sha256 of the lowercased word: the repo is public, so the
 * check must not publish the very words it keeps off the page.
 */
const LAB_SOURCE = new Set(["48e07a034200f3b5fd196609e3692cab8f25432b2e39014197a81082437703ca", "bd0ced8bbecf2a5bdca194d7c72d63f2d1d6f0c2b64697b0d6bbc82e680e398b"]);

test("the BlogCMS summary says nothing that identifies the lab", () => {
  const src = readFileSync(new URL("../ops/reports/blogcms.md", import.meta.url), "utf8");
  const html = renderDoc(src, { dir: ["reports"], links: {} });
  for (const leak of ["/api/", ".php", "localhost", "http"]) {
    assert.ok(!html.includes(leak), `the BlogCMS page contains ${leak}`);
  }
  for (const word of new Set(html.match(/[A-Za-z0-9_]+/g) ?? [])) {
    const h = createHash("sha256").update(word.toLowerCase()).digest("hex");
    assert.ok(!LAB_SOURCE.has(h), `the BlogCMS page names something from the lab's source (sha256 ${h.slice(0, 12)})`);
  }
});

test("no tracked file names the lab's source, so the public repo cannot either", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: new URL("..", import.meta.url), encoding: "utf8" }).split("\0").filter(Boolean);
  for (const f of files.filter((f) => /\.(md|ts|json|jsonc|yml)$/.test(f))) {
    const text = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const word of new Set(text.match(/[A-Za-z0-9_]+/g) ?? [])) {
      const h = createHash("sha256").update(word.toLowerCase()).digest("hex");
      assert.ok(!LAB_SOURCE.has(h), `${f} names something from the lab's source`);
    }
  }
});

test("the shell's home holds ops/ itself, not its contents", () => {
  const home = homeTree(fixture());
  assert.ok(home.dir);
  if (home.dir) assert.deepEqual(Object.keys(home.kids), ["ops"]);
});

test("Obsidian image embeds show as images, with or without a caption", () => {
  const html = renderDoc("![[shot.png]] and ![[deep/flag.jpg|the flag]] and ![[notes]]", { dir: ["writeups"], links: { notes: "/ops/notes" } });
  assert.match(html, /<img src="\/ops\/writeups\/shot.png" alt="shot.png"/);
  assert.match(html, /<img src="\/ops\/writeups\/deep\/flag.jpg" alt="the flag"/);
  assert.ok(!html.includes("![["), "no embed is left as raw text");
});

test("review: [[ ]] inside code is left exactly as written", () => {
  const html = renderDoc("```bash\nif [[ -f /etc/passwd ]]; then echo y; fi\n```\n\nrun `[[ -n $x ]]` first, see [[certs]]", { dir: [], links: { certs: "/ops/certs" } });
  assert.ok(html.includes("if [[ -f /etc/passwd ]]; then"), "the fenced bash block lost its brackets");
  assert.ok(html.includes("[[ -n $x ]]"), "the inline code lost its brackets");
  assert.match(html, /<a href="\/ops\/certs">certs<\/a>/, "a wikilink outside code still links");
});

test("review: an embedded screenshot with spaces in its name renders", () => {
  const html = renderDoc("![[Pasted image 20261120.png]]", { dir: ["writeups"], links: {} });
  assert.match(html, /<img src="\/ops\/writeups\/Pasted%20image%2020261120.png"/);
});

test("review: two files that would share an address stop the build", () => {
  const root = mkdtempSync(join(tmpdir(), "ops-"));
  mkdirSync(join(root, "w"));
  writeFileSync(join(root, "w", "My Note.md"), "# a");
  writeFileSync(join(root, "w", "my-note.md"), "# b");
  assert.throws(() => readOps(pathToFileURL(root + "/")), /same address/);
  const root2 = mkdtempSync(join(tmpdir(), "ops-"));
  writeFileSync(join(root2, "日本.md"), "# c");
  assert.throws(() => readOps(pathToFileURL(root2 + "/")), /no usable address/);
});

test("callouts: a fold marker is not part of the title", () => {
  for (const mark of ["-", "+"]) {
    const html = renderDoc(`> [!faq]${mark} Folded\n> inside\n`, { dir: [], links: {} });
    assert.match(html, /<aside class="callout callout-faq"><p class="callout-title">Folded<\/p>/, mark);
  }
});

test("callouts: a title with bold or code is still a callout", () => {
  const html = renderDoc("> [!warning] **careful** with `rm`\n> body\n", { dir: [], links: {} });
  assert.match(html, /<aside class="callout callout-warning"><p class="callout-title"><strong>careful<\/strong> with <code>rm<\/code><\/p>/);
  assert.ok(!html.includes("[!warning]"));
});

test("minor 2: [[note#heading]] and [[note.md]] link to the note", () => {
  const links = { "tools/saltpilot": "/ops/tools/saltpilot" };
  const html = renderDoc("[[saltpilot#install]] and [[saltpilot.md]]", { dir: [], links });
  assert.equal((html.match(/<a href="\/ops\/tools\/saltpilot">/g) || []).length, 2);
});

test("minor 2: two notes with one name resolve to the one beside the document, else by path", () => {
  const links = { "writeups/notes": "/ops/writeups/notes", "labs/notes": "/ops/labs/notes" };
  assert.match(renderDoc("[[notes]]", { dir: ["labs"], links }), /href="\/ops\/labs\/notes"/);
  assert.match(renderDoc("[[writeups/notes]]", { dir: ["labs"], links }), /href="\/ops\/writeups\/notes"/);
  assert.ok(!renderDoc("[[notes]]", { dir: ["reports"], links }).includes("<a "), "ambiguous from elsewhere: plain text, not a guess");
});

test("minor 3: the title skips code and drops Markdown marks", () => {
  const root = mkdtempSync(join(tmpdir(), "ops-"));
  writeFileSync(join(root, "a.md"), "```bash\n# not a title\n```\n\n# **Real** `Title`\n");
  assert.equal(readOps(pathToFileURL(root + "/")).docs[0]!.title, "Real Title");
});

test("security: a payload written in prose shows as text, never runs", () => {
  const html = renderDoc('the bug: <img src=x onerror=alert(1)> and <script>alert(2)</script>\n\n<div onclick="x()">block</div>\n', { dir: [], links: {} });
  assert.ok(!/<img src=x|<script>|<div onclick/.test(html), html);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "the payload stays readable as text");
});

test("security: javascript: and data: links do not become links", () => {
  const html = renderDoc("[click](javascript:alert(1)) and [d](data:text/html,x) and [ok](https://example.com)", { dir: [], links: {} });
  assert.ok(!/href="(javascript|data):/i.test(html), html);
  assert.match(html, /<a href="https:\/\/example.com">ok<\/a>/);
});

test("security: harmless formatting tags without attributes still work", () => {
  const html = renderDoc("press <kbd>Ctrl</kbd>+<kbd>C</kbd>, H<sub>2</sub>O<br>next", { dir: [], links: {} });
  assert.ok(html.includes("<kbd>Ctrl</kbd>") && html.includes("<sub>2</sub>") && html.includes("<br>"), html);
});
