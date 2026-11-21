import test from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../src/content.ts";
import { nappingCfg } from "../src/screens.ts";
import { openEffort, move, slideBack, effortRows, effortPanel, SCALE_WIDTH, confirmReply } from "../src/client/effort.ts";

const c = nappingCfg(loadContent()).effort;
const LAZY = c.labels.indexOf("lazy");

test("the panel opens on lazy with Ultrachill on", () => {
  const s = openEffort(c);
  assert.equal(c.labels[s.at], "lazy");
  assert.equal(s.ultrachill, "on");
  assert.equal(s.note, c.toggleNote);
});

test("arrows move one level and stop at the ends", () => {
  let s = openEffort(c);
  s = move(c, s, 1);
  assert.equal(s.at, LAZY, "nothing past lazy");
  for (let i = 0; i < 10; i++) s = move(c, s, -1);
  assert.equal(s.at, 0, "nothing below low");
  assert.equal(move(c, s, 1).at, 1);
});

test("whatever is picked, the marker walks back to lazy one level at a time", () => {
  assert.deepEqual(slideBack(c, 0), [1, 2, 3, 4]);
  assert.deepEqual(slideBack(c, 2), [3, 4]);
  assert.deepEqual(slideBack(c, LAZY), []);
});

test("the reply names what was asked for, and is pleased by lazy", () => {
  assert.equal(confirmReply(c, 2), "effort set to lazy. (you asked for high)");
  assert.equal(confirmReply(c, LAZY), "effort set to lazy. great minds.");
});

test("the title and the scale fit a 40-column screen at every position (the key hints are prose and wrap)", () => {
  for (let at = 0; at < c.labels.length; at++) {
    for (const ultrachill of ["on", "off"] as const) {
      const p = effortPanel(c, { at, ultrachill, note: c.loadBearing });
      for (const row of [...p.title, ...p.scale]) {
        for (const r of row.runs) assert.ok(r.col + [...r.text].length <= 40, `"${r.text}" ends at ${r.col + [...r.text].length}`);
      }
    }
  }
});

test("the marker sits over the middle of the selected level, which is the one drawn bold", () => {
  for (let at = 0; at < c.labels.length; at++) {
    const rows = effortRows(c, { at, ultrachill: "on", note: "" });
    const level = rows.flatMap((r) => r.runs).find((r) => r.cls?.includes(`eff-lv-${at}`))!;
    const marker = rows.flatMap((r) => r.runs).find((r) => r.text === "▲")!;
    assert.equal(marker.col, level.col + Math.floor(([...level.text].length - 1) / 2), c.labels[at]);
    assert.equal(level.style, "accent-bold");
  }
  const all = effortRows(c, openEffort(c)).flatMap((r) => r.runs);
  assert.ok(all.find((r) => r.text === "lazy")!.cls!.includes("eff-lazy"), "lazy carries the rainbow");
  assert.ok(all.find((r) => r.text === c.toggleWord)!.cls!.includes("eff-toggle"), "Ultrachill is tappable");
});

test("laid out like an agent CLI's picker: title left, a centred scale spread edge to edge, hints at the bottom", () => {
  const p = effortPanel(c, openEffort(c));
  assert.deepEqual(p.title.map((r) => r.runs.map((x) => [x.col, x.text])), [[[0, c.word]]]);
  const [ends, track, levels] = p.scale;
  const e = ends!.runs;
  assert.deepEqual([e[0]!.col, e[0]!.text], [0, c.ends.start], "Faster at the left edge");
  assert.equal(e.at(-1)!.col + [...e.at(-1)!.text].length, SCALE_WIDTH, "Smarter at the right edge");
  const t = track!.runs;
  assert.equal(t[0]!.col, 0);
  assert.equal(t.at(-1)!.col + [...t.at(-1)!.text].length, SCALE_WIDTH, "the line runs the full width");
  const l = levels!.runs;
  assert.equal(l[0]!.col, 0, "the first level starts at the left edge");
  assert.equal(l.at(-1)!.col + [...l.at(-1)!.text].length, SCALE_WIDTH, "the last level ends at the right edge");
  const gaps = l.slice(1).map((x, i) => x.col - (l[i]!.col + [...l[i]!.text].length));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, `levels are spread evenly: ${gaps}`);
  const note = p.scale.flatMap((r) => r.runs).find((x) => x.text === c.toggleNote)!;
  assert.equal(note.col, Math.floor((SCALE_WIDTH - [...c.toggleNote].length) / 2), "the description is centred under the scale");
  assert.deepEqual(p.help.map((r) => r.runs.length), [1]);
  assert.match(p.help[0]!.runs[0]!.text, /Tab/);
  assert.match(p.help[0]!.runs[0]!.text, /Ultrachill/);
});
