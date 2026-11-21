import test from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../src/content.ts";
import { shellHtml } from "../src/html.ts";
import { bootSchedule, bootCss, BUDGET_MS } from "../src/boot.ts";

const c = loadContent();
const html = shellHtml(c, "", { dir: true, kids: { ops: { dir: true, kids: {} } } });

test("the boot hands over the prompt inside the 1.5 s budget", () => {
  const s = bootSchedule({ motd: 11, typed: 4, help: 7 });
  assert.equal(BUDGET_MS, 1500);
  assert.ok(s.prompt <= BUDGET_MS, `prompt live at ${s.prompt} ms`);
  const order = [...s.motd, s.echo, ...s.typed, ...s.help, s.prompt];
  for (let i = 1; i < order.length; i++) assert.ok(order[i]! > order[i - 1]!, `step ${i} is not after step ${i - 1}`);
});

test("the help exchange is already in the page, for readers without JavaScript", () => {
  const log = html.slice(html.indexOf('id="log"'), html.indexOf('id="prompt"'));
  assert.ok(log.includes(">h<") && log.includes(">e<") && log.includes(">l<") && log.includes(">p<"), "help is typed letter by letter");
  assert.ok(log.includes("ls · cd · cat"), "help's output is there");
  assert.ok(log.includes("resume"), "help lists the pages");
});

test("only a tab that has not booted, without reduced motion, is marked to boot, before first paint", () => {
  const head = html.slice(0, html.indexOf("<body>"));
  assert.match(head, /<script>[^<]*lazie:booted[^<]*prefers-reduced-motion[^<]*booting[^<]*<\/script>/);
});

test("every revealed element has a scheduled time, and the masthead is never hidden", () => {
  const used = [...new Set([...html.matchAll(/\b(b[mthpek](?:-\d+)?)\b/g)].map((m) => m[1]!))];
  const css = bootCss(bootSchedule({ motd: 11, typed: 4, help: 7 }));
  for (const cls of used) assert.ok(css.includes(`.${cls}`), `${cls} has no delay`);
  const motd = html.slice(html.indexOf('id="motd"'), html.indexOf('id="log"'));
  for (const row of motd.split("\n").filter((l) => l.includes('class="row bn"'))) assert.ok(!/\bbm-\d/.test(row), "a wordmark row is hidden");
});

test("boot rules only apply while booting, and every animation steps", () => {
  const css = bootCss(bootSchedule({ motd: 11, typed: 4, help: 7 }));
  for (const rule of css.split("\n").filter((l) => l.includes("animation"))) {
    assert.ok(rule.startsWith(".booting ") || rule.startsWith("@keyframes"), rule);
    if (rule.includes("animation:")) assert.match(rule, /step-end/);
  }
});

test("review: lines hide with opacity, so screen readers keep them and live regions stay quiet", () => {
  const css = bootCss(bootSchedule({ motd: 11, typed: 4, help: 7 }));
  assert.match(css, /@keyframes boot-in \{ from \{ opacity: 0 \} to \{ opacity: 0 \} \}/);
  assert.ok(!css.includes("visibility"), "visibility drops nodes from the accessibility tree");
});

test("review: the real page, with its real line counts, goes live inside the budget", () => {
  const cfg = JSON.parse(html.slice(html.indexOf('id="cfg">') + 9, html.indexOf("</script>", html.indexOf('id="cfg">'))).replace(/\\u003c/g, "<"));
  assert.ok(cfg.bootEnd > 0 && cfg.bootEnd <= BUDGET_MS, `bootEnd ${cfg.bootEnd}`);
  const bp = /\.booting \.bp \{[^}]*animation-delay: (\d+)ms/.exec(html);
  assert.equal(Number(bp?.[1]), cfg.bootEnd, "the live prompt's delay is the boot's end");
});

test("review: the hint appears only when the boot ends, so it never flashes its final text before scrambling", () => {
  const hintRow = /<div class="([^"]*)" id="hint">/.exec(html)?.[1] ?? "";
  assert.ok(hintRow.includes("bk") && !hintRow.includes("bp"), hintRow);
  const s = bootSchedule({ motd: 11, typed: 4, help: 7 });
  const bk = /\.booting \.bk \{[^}]*animation-delay: (\d+)ms/.exec(bootCss(s));
  assert.ok(Number(bk?.[1]) > s.prompt, "the hint waits past the prompt, for the client to reveal it");
});
