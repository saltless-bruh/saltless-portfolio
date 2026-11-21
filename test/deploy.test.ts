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
  assert.equal(cfg.active, "404", "a focused screen, with no window lit in the bar");
  assert.ok(!/class="[^"]*\bwin on\b/.test(html), "no window claims to be this page");
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
