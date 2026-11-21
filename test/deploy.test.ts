import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadContent } from "../src/content.ts";
import { notFoundHtml } from "../src/html.ts";

const c = loadContent();
const read = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a missing address answers in zsh's words, and q goes back to the shell", () => {
  const html = notFoundHtml(c, "");
  assert.match(html, /no such file or directory/);
  assert.match(html, /q \/ Esc · back to the shell/);
  assert.match(html, /<script type="module" src="\/app.js">/, "absolute, so it loads from any depth");
  const cfg = JSON.parse(html.slice(html.indexOf('id="cfg">') + 9, html.indexOf("</script>", html.indexOf('id="cfg">'))).replace(/\\u003c/g, "<"));
  assert.equal(cfg.active, "404", "a focused screen: q or Esc goes home");
});

test("Cloudflare serves dist/ as assets only, with the 404 page for anything missing", () => {
  const cfg = JSON.parse(read("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(cfg.name, "lazie");
  assert.equal(cfg.main, undefined, "assets only: no Worker script (ADR 0002's telemetry was dropped)");
  assert.equal(cfg.assets.directory, "./dist");
  assert.equal(cfg.assets.not_found_handling, "404-page");
  assert.equal(cfg.assets.run_worker_first, undefined, "on the free plan it turns asset requests into 429s");
});

test("the deploy runs only after tests, typecheck and a clean build pass, on Node 26", () => {
  const wf = read(".github/workflows/deploy.yml");
  const order = ["npm ci", "npm test", "npm run typecheck", "npm run build", "wrangler deploy"].map((s) => wf.indexOf(s));
  for (const [i, at] of order.entries()) assert.ok(at > 0, `step ${i} missing`);
  for (let i = 1; i < order.length; i++) assert.ok(order[i]! > order[i - 1]!, `step ${i} runs before step ${i - 1}`);
  assert.match(wf, /node-version: ['"]?26/);
  assert.match(wf, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(wf, /if: github\.event_name == 'push'/, "pull requests are checked, never deployed");
  assert.match(wf, /permissions:\s*\n\s*contents: read/);
});

test("help never lists a route with no page behind it", async () => {
  const { loadContent } = await import("../src/content.ts");
  const { existsSync } = await import("node:fs");
  const { build } = await import("../src/build.ts");
  await build();
  for (const s of loadContent().screens) assert.ok(existsSync(new URL(`../dist/${s.cmd}/index.html`, import.meta.url)), `${s.cmd} is in help but 404s`);
});

test("no page carries the tmux window bar any more", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const pages = readdirSync(new URL("../dist/", import.meta.url), { recursive: true }).map(String).filter((f) => f.endsWith(".html"));
  assert.ok(pages.length > 5);
  for (const f of pages) assert.doesNotMatch(readFileSync(new URL(`../dist/${f}`, import.meta.url), "utf8"), /class="row bar|0:shell/, f);
});

test("the MOTD shows no placeholder that will never fill (gpu/model went with telemetry)", async () => {
  const { motdRows } = await import("../src/motd.ts");
  const { loadContent } = await import("../src/content.ts");
  const text = motdRows(loadContent()).flatMap((r) => r.runs.map((x) => x.text)).join("\n");
  assert.doesNotMatch(text, /^(gpu|model):/m);
  assert.doesNotMatch(text, /^--$/m);
});

test("a page someone can be linked to straight from a CV shows the way back as man's status line", async () => {
  const { screenHtml } = await import("../src/html.ts");
  const { loadContent } = await import("../src/content.ts");
  const { COLS_NARROW } = await import("../src/grid.ts");
  for (const cmd of ["resume", "privacy", "contact"] as const) {
    const html = screenHtml(loadContent(), "", cmd);
    const m = /<a class="pager" href="\/">([^<]*)<\/a>/.exec(html);
    assert.ok(m, `${cmd} has no way back`);
    assert.equal(m[1], `Manual page ${cmd}(1) (press q to quit)`);
    assert.ok(m[1].length <= COLS_NARROW, `${cmd}'s status line overflows a phone`);
  }
});

test("pre and code use the site's face, not the browser's generic monospace (which draws arrows two cells wide)", async () => {
  const { css } = await import("../src/css.ts");
  assert.match(css(""), /pre, code, kbd, samp \{ font-family: inherit; font-size: 1em \}/);
});
