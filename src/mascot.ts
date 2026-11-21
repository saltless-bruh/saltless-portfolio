import { loadGlyphs, loadGrid, runsOf, runsToPath, sharedInkLeft, sharedInkWidth, type Box, type Grid } from "./pixelart.ts";
import { DREAMING, MASCOT_TIMELINE, type PoseName } from "./timeline.ts";
import { ADVANCE, LINE } from "./grid.ts";
import { TELEMETRY_TODAY, type Telemetry } from "./telemetry.ts";

/**
 * The Mascot: Lazie, asleep on the rack. The site's own renderer, written for the site's fluid cell
 * rather than copied from the profile, whose `mascot.ts` drew into a fixed SVG canvas.
 *
 * Governed by `art/ART-DIRECTION.md`, which travelled with the grids. Its rules are enforced below as
 * code, because a rule a renderer merely intends to follow is the kind that quietly stops holding.
 */
const ART = new URL("../art/", import.meta.url);
const GRID_W = 64;
const GRID_H = 28;
/** Rows 0 to 10 are the cat, 11 to 27 the rack. The profile's number, taken rather than re-derived. */
export const RACK_FROM = 11;
const REST: PoseName = "sleep";

/**
 * One art pixel is half a cell wide and a quarter of a cell tall, and those two are the same length,
 * because the row pitch is locked to twice the column (`grid.ts`, CELL_H). So the scene is exactly
 * 32 columns by 7 rows at every size, and the art pixel is square without anything maintaining it.
 */
export const PIXEL_EM = ADVANCE / 2;
if (Math.abs(PIXEL_EM - LINE / 4) > 1e-9) throw new Error("an art pixel is no longer square: the cell ratio changed");
export const MASCOT_COLS = GRID_W / 2;
export const MASCOT_ROWS = GRID_H / 4;

const glyphs = loadGlyphs(new URL("palette.json", ART));
/**
 * In-betweens drawn for the site, not present in the profile. `yawn-in` is the jaw dropping before
 * the head tips back: the sleep pose with the lowest row of the yawn's mouth opened, 3 pixels in all.
 * Linted with the PixelLab workbench (0 errors, 0 warnings) and compared against sleep (exactly the
 * 3 jaw pixels at x26-28, row 10).
 */
export const TWEENS = ["yawn-in"] as const;
type Frame = PoseName | (typeof TWEENS)[number];
export const POSE_NAMES = [...new Set<Frame>([...MASCOT_TIMELINE.map((e) => e.state), ...TWEENS])];
export const POSES: Record<string, Grid> = Object.fromEntries(
  POSE_NAMES.map((n) => [n as string, loadGrid(new URL(`${n}.grid.txt`, ART), { glyphs, width: GRID_W, height: GRID_H })]),
);

/**
 * The recolour, from the art direction's table. Characters map to palette TOKENS, never to hex, so
 * both theme variants follow automatically. `3` is deliberately absent from the cat: in the cat rows
 * an eye is a hole, and an unpainted pixel is the window showing through.
 */
type Ink = { chars: string; cls: string };
const CAT: Ink[] = [
  { chars: "2", cls: "m-text" },
  { chars: "4", cls: "m-accent" },
  { chars: "1", cls: "m-muted" },
];
/** In the rack rows `3` is the frame, in `border` (the art direction's amendment: without it the panel has no silhouette). */
const RACK: Ink[] = [
  { chars: "5", cls: "m-surface" },
  { chars: "389", cls: "m-border" },
  // Every LED is painted dim here, lit or not: the lit state is its own layer (LEDS), switched by
  // the telemetry state rather than baked into the chassis.
  { chars: "67", cls: "m-muted" },
];
const CAT_CHARS = "1234";
const RACK_CHARS = "356789";
const LIT = "6";
const LED_CHARS = "67";

/**
 * The rack's LEDs, one pixel each, read from the rest pose. The POWER LED is the leftmost column lit
 * in every unit (the art draws it on in all three); the rest are ACTIVITY. `drawn` is the art's own lit/dim
 * pattern, which is the frozen `stale` look and the default still frame.
 */
export const LEDS: { x: number; y: number; power: boolean; drawn: boolean }[] = (() => {
  const rows = POSES[REST]!.rows;
  const px: { x: number; y: number; lit: boolean }[] = [];
  rows.forEach((r, y) => { if (y >= RACK_FROM) [...r].forEach((c, x) => { if (LED_CHARS.includes(c)) px.push({ x, y, lit: c === LIT }); }); });
  const units = new Set(px.map((p) => p.y));
  const always = [...new Set(px.map((p) => p.x))].filter((x) => [...units].every((y) => px.some((p) => p.x === x && p.y === y && p.lit)));
  if (always.length === 0) throw new Error("no power LED: no column is lit in every rack unit");
  // One power LED per unit: the leftmost always-lit column. The art also lights x21 in every unit,
  // which is just a busy activity light in the drawing; two power lights per unit would read as noise.
  const power = Math.min(...always);
  return px.map((p) => ({ x: p.x, y: p.y, power: p.x === power, drawn: p.lit }));
})();

// The rack is drawn ONCE, from the rest pose, so every pose must agree with it. Checked, not assumed.
for (const name of POSE_NAMES) {
  const g = POSES[name]!;
  g.rows.forEach((row, y) => {
    const region = y < RACK_FROM ? CAT_CHARS : RACK_CHARS;
    for (const ch of row) {
      if (ch !== " " && !region.includes(ch)) {
        throw new Error(`${g.name}: ${JSON.stringify(ch)} at row ${y} does not belong in the ${y < RACK_FROM ? "cat" : "rack"} rows`);
      }
    }
    if (y >= RACK_FROM && row !== POSES[REST]!.rows[y]) {
      throw new Error(`${g.name}: rack row ${y} differs from ${REST}, but the rack is drawn once`);
    }
  });
}

/**
 * Flush left: her INK lands on the same margin the prompt and every row start from (the profile's
 * glossary, Header). The grids carry blank pixels on their left, so the drawing is cropped to the
 * ink. `sharedInkLeft` throws unless every pose shares that edge, which is what stops her shifting
 * sideways between frames.
 */
export const INK_LEFT = sharedInkLeft(Object.values(POSES));
export const INK_WIDTH = sharedInkWidth(Object.values(POSES));

const CAT_BOX: Box = { x0: 0, x1: GRID_W, y0: 0, y1: RACK_FROM };
const RACK_BOX: Box = { x0: 0, x1: GRID_W, y0: RACK_FROM, y1: GRID_H };

const paint = (rows: string[], inks: Ink[], box: Box): string =>
  inks
    .map((ink) => ({ ink, d: runsToPath(runsOf(rows, ink.chars, box), 0, 0, 1) }))
    .filter((p) => p.d)
    .map((p) => `<path class="${p.ink.cls}" d="${p.d}"/>`)
    .join("");

export type Window = { state: Frame; from: number; to: number };
const seq = (steps: [Frame, number][]): Window[] => {
  let t = 0;
  return steps.map(([state, d]) => { const w = { state, from: t, to: Number((t + d).toFixed(3)) }; t = w.to; return w; });
};

/**
 * THE SITE'S OWN TEMPO. The profile's loop was 28 s with holds of 7.5 s, 5 s and 6.25 s in which no
 * pixel moved; the user's verdict was "way too slow", and the sprite reference agrees: an idle loop
 * runs about 4 frames at 200-300 ms, and even ambient breathing tops out at 500 ms a frame.
 *
 * Holds here are still a few seconds, because breathing and the zZz run underneath every one of them
 * (see MAX_STILL). The drawn order is the profile's; two beats are new. `yawn-in` is the jaw dropping
 * before the head tips back, and `settle` is shown briefly before the stretch as well as after it,
 * because it is already the halfway pose between sleep and stretch: hump half up, paws half out.
 * One in-between, used on the way in and the way out, is ordinary animation practice.
 */
export const IDLE: Window[] = seq([
  ["sleep", 3.2], ["yawn-in", 0.15], ["yawn", 1.1], ["settle", 0.2], ["stretch", 1.4],
  ["settle", 0.8], ["sleep", 3.0], ["peek", 0.6], ["sleep", 1.55],
]);
/** The alarm keeps the profile's order and timing: it is fast already, and it is a one-shot. */
const ALARM_AT = MASCOT_TIMELINE.findIndex((e) => e.state === "alert");
export const ALARM: Window[] = MASCOT_TIMELINE.slice(ALARM_AT).map((e) => ({ ...e, from: e.from - MASCOT_TIMELINE[ALARM_AT]!.from, to: e.to - MASCOT_TIMELINE[ALARM_AT]!.from }));
export const IDLE_SECONDS = IDLE.at(-1)!.to;
export const ALARM_SECONDS = ALARM.at(-1)!.to;

/** Seconds on the loop's clock. `to` may run past the loop's length when a span crosses the seam. */
export type Span = [from: number, to: number];

type Px = { x: number; y: number };
const stamp = (x0: number, y0: number, rows: string[]): Px[] =>
  rows.flatMap((r, dy) => [...r].flatMap((c, dx) => (c === "1" ? [{ x: x0 + dx, y: y0 + dy }] : [])));

/**
 * The nose bubble, stamped at its own coordinates rather than drawn into the poses, so it animates
 * on its own clock. Copied from the profile (`src/mascot.ts` there): the sleep grid is byte-identical,
 * so the place in the free space left of the face carries over. One pixel grows into a 3x3 ring;
 * the burst is a 5x5 diamond around it.
 */
export const BUBBLE_PIXELS = {
  steps: [
    stamp(21, 7, ["1"]),
    stamp(20, 6, ["11", "11"]),
    stamp(19, 5, [" 1 ", "1 1", " 11"]),
    stamp(19, 5, ["111", "1 1", "111"]),
  ],
  burst: stamp(17, 4, ["  1  ", " 1 1 ", "1   1", " 1 1 ", "  1  "]),
};
const BUBBLE_STEPS = BUBBLE_PIXELS.steps.length;

/**
 * The nose bubble's schedule, DERIVED from the loop. The profile popped it at `alert`; the site's
 * idle has no alarm (that waits for the first Finding), so the jaw drop at `yawn-in` pops it
 * instead: cause and effect. It inflates across the whole nap before that, walked back over the
 * dreaming states (so `peek` keeps it up, which is the joke) and across the loop seam, in four
 * equal steps. The burst ring shows for exactly `yawn-in`, then nothing.
 */
export function bubbleSchedule(idle: Window[] = IDLE): { steps: Span[]; burst: Span } {
  const i = idle.findIndex((w) => w.state === "yawn-in");
  if (i < 0) throw new Error("the nose bubble pops at yawn-in, which this loop does not contain");
  const total = idle.at(-1)!.to;
  let nap = 0;
  for (let j = (i - 1 + idle.length) % idle.length; j !== i && isDreaming(idle[j]!.state); j = (j - 1 + idle.length) % idle.length) {
    nap += idle[j]!.to - idle[j]!.from;
  }
  if (nap === 0) throw new Error(`the nose bubble needs a sleeping window before yawn-in to inflate in`);
  const from = (((idle[i]!.from - nap) % total) + total) % total;
  const steps = Array.from({ length: BUBBLE_STEPS }, (_, k): Span => [from + (nap * k) / BUBBLE_STEPS, from + (nap * (k + 1)) / BUBBLE_STEPS]);
  return { steps, burst: [idle[i]!.from, idle[i]!.to] };
}
const FAULT_UNTIL = ALARM.find((e) => e.state === "recover")!.from;

/** Breathing: rest, then the body lifts one pixel with the belly still on the rack. */
export const BREATH = { rest: 0.7, inhale: 0.5 } as const;
/** The zZz build up one at a time from the smallest, then clear. */
export const ZZZ = { step: 0.4, hold: 0.6, gap: 0.4 } as const;
/** The longest any idle frame may sit with nothing on screen changing. The sprite reference's slow bound, plus breath. */
export const MAX_STILL = 0.7;

const IDLE_FRAMES = new Set<Frame>(IDLE.map((w) => w.state));
const isDreaming = (n: Frame): boolean => (DREAMING as Frame[]).includes(n);

/** An idle pose with its zZz removed: they are drawn as their own layer so they can build and clear. */
const body = (n: Frame): string[] => POSES[n]!.rows.map((r, y) => (y < RACK_FROM && IDLE_FRAMES.has(n) ? r.replace(/1/g, " ") : r));

/**
 * The inhale, GENERATED rather than drawn, because it is a rule and not a decision: everything above
 * the belly lifts one pixel and the belly row stays on the rack, so the body grows a pixel taller and
 * never floats. Valid for every pose, which is why the breathing never stops between them.
 */
export function inhale(rows: string[]): string[] {
  const top = rows.slice(0, RACK_FROM).findIndex((r) => r.trim().length > 0);
  if (top < 1) throw new Error("no headroom: the inhale would push the top row off the canvas");
  return rows.map((r, y) => (y < RACK_FROM - 1 ? rows[y + 1]! : r));
}

/** Connected groups of zZz pixels, smallest-and-lowest first, which is the order they appear in. */
function zzzGroups(n: Frame): { x: number; y: number }[][] {
  const rows = POSES[n]!.rows;
  const px = new Set<string>();
  rows.forEach((r, y) => { if (y < RACK_FROM) [...r].forEach((c, x) => { if (c === "1") px.add(`${x},${y}`); }); });
  const groups: { x: number; y: number }[][] = [];
  for (const start of px) {
    const g: { x: number; y: number }[] = [];
    const stack = [start];
    px.delete(start);
    while (stack.length) {
      const [x, y] = stack.pop()!.split(",").map(Number) as [number, number];
      g.push({ x, y });
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const k = `${x + dx},${y + dy}`;
        if (px.delete(k)) stack.push(k);
      }
    }
    groups.push(g);
  }
  return groups.sort((a, b) => b.reduce((s, p) => s + p.y, 0) / b.length - a.reduce((s, p) => s + p.y, 0) / a.length);
}

/** How many zZz shapes the art draws. Read from it, not assumed: it is two, a Z and a smaller z above it. */
export const ZZZ_COUNT = Math.max(...POSE_NAMES.filter(isDreaming).map((n) => zzzGroups(n).length));

const pixelPath = (pts: { x: number; y: number }[]): string => pts.map((p) => `M${p.x} ${p.y}h1v1h-1z`).join("");

export function mascotSvg(state: Telemetry = TELEMETRY_TODAY): string {
  const rest = POSES[REST]!;
  const poses = POSE_NAMES
    .map((n) => {
      const rest = body(n);
      const breath = IDLE_FRAMES.has(n) ? `<g class="br1">${paint(inhale(rest), CAT, CAT_BOX)}</g>` : "";
      const zzz = isDreaming(n) ? zzzGroups(n).map((g, i) => `<path class="m-muted zz zz${i}" d="${pixelPath(g)}"/>`).join("") : "";
      return `<g class="pose p-${n}"><g class="br0">${paint(rest, CAT, CAT_BOX)}</g>${breath}${zzz}</g>`;
    })
    .join("");
  const leds = runsToPath(runsOf(rest.rows, LIT, RACK_BOX), 0, 0, 1);
  // Drawn twice, at rest and one pixel up, inside the breath groups: it is on her nose, so it rises
  // with the inhale like the rest of the face instead of floating off it.
  const layers = [...BUBBLE_PIXELS.steps.map((p, k) => [`bb${k}`, p] as const), ["bbx", BUBBLE_PIXELS.burst] as const];
  const bubbleAt = (dy: number) => layers.map(([c, p]) => `<path class="m-muted bb ${c}" d="${pixelPath(p.map((q) => ({ x: q.x, y: q.y + dy })))}"/>`).join("");
  const bubble = `<g class="bubble"><g class="br0">${bubbleAt(0)}</g><g class="br1">${bubbleAt(-1)}</g></g>`;
  return `<svg class="mascot" viewBox="${INK_LEFT} 0 ${INK_WIDTH} ${GRID_H}" shape-rendering="crispEdges" role="img" `
    + `aria-label="a pixel cat asleep on a server rack" data-telemetry="${state}">`
    + `<g class="rack">${paint(rest.rows, RACK, RACK_BOX)}</g>`
    + LEDS.map((l, k) => `<path class="m-accent led led${k} ${l.power ? "pwr" : "act"}${l.drawn ? " drawn" : ""}" d="${pixelPath([l])}"/>`).join("")
    + `<path class="m-error led-fault" d="${leds}"/>`
    + poses
    + bubble
    + `</svg>`;
}

const pct = (t: number, total: number): string => `${Number(((t / total) * 100).toFixed(4))}%`;

/**
 * Stepped keyframes that show a layer during `spans` of a `total`-second loop and hide it otherwise.
 * A span that starts past `total` is shifted back a lap; one that runs past it is split at the seam.
 */
function showDuring(name: string, spans: Span[], total: number, selector = `.mascot .${name}`): string {
  const on = spans
    .map(([a, b]): Span => (a >= total ? [a - total, b - total] : [a, b]))
    .flatMap(([a, b]): Span[] => (b > total ? [[a, total], [0, b - total]] : [[a, b]]));
  const at = (t: number) => (on.some(([a, b]) => a <= t && t < b) ? 1 : 0);
  const edges = [...new Set(on.flat().filter((t) => t > 0 && t < total))].sort((a, b) => a - b);
  let last = at(0);
  const frames = [`0%{opacity:${last}}`];
  for (const t of edges) { const v = at(t); if (v !== last) { frames.push(`${pct(t, total)}{opacity:${v}}`); last = v; } }
  frames.push(`100%{opacity:${last}}`);
  return `@keyframes ${name}{${frames.join("")}}\n${selector}{animation:${name} ${total}s step-end infinite}`;
}

/** Seconds per activity LED's loop, and the standby blink's period (1 s on, 1 s off). */
const FLICKER_LOOP = 6;
const STANDBY = 2;

/** mulberry32: a tiny seeded PRNG, so the flicker is the same on every build and every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One activity LED's ON spans over a `total`-second loop: mostly on, with short off blips, the way
 * disk and network lights read. On runs 0.3-1.4 s, blips 0.08-0.25 s (long enough to see at a
 * stepped cut, short enough to read as activity rather than a fault). The first span starts at 0
 * and the final blip closes the loop, so the seam is just another blip.
 */
export function flickerPattern(seed: number, total: number): Span[] {
  const r = rng(seed);
  const between = (lo: number, hi: number) => Number((lo + r() * (hi - lo)).toFixed(3));
  const on: Span[] = [];
  let t = 0;
  while (total - t > 2) {
    const len = between(0.3, 1.4);
    on.push([t, Number((t + len).toFixed(3))]);
    t = Number((t + len + between(0.08, 0.25)).toFixed(3));
  }
  on.push([t, Number((total - between(0.08, 0.25)).toFixed(3))]);
  return on;
}

/**
 * One `@keyframes` per pose, showing it only inside its own windows. Every keyframe holds until the
 * next and then CUTS: the timing function is `step-end`, so no pose ever fades into another. That is
 * the whole motion language of the site, and the cat is the first thing built on it.
 */
function poseKeyframes(prefix: string, timeline: Window[], total: number): string {
  return POSE_NAMES.map((name) => {
    const at = (t: number) => (timeline.find((e) => e.from <= t && t < e.to)?.state === name ? 1 : 0);
    const frames: string[] = [`0%{opacity:${at(0)}}`];
    let last = at(0);
    for (const e of timeline) {
      const v = e.state === name ? 1 : 0;
      if (v !== last) { frames.push(`${pct(e.from, total)}{opacity:${v}}`); last = v; }
    }
    frames.push(`100%{opacity:${last}}`);
    return `@keyframes ${prefix}-${name}{${frames.join("")}}`;
  }).join("\n");
}

export function mascotCss(): string {
  return `
/* The art pixel, snapped to a whole device pixel where the browser can round: pixel art resampled
   to 4.2px draws some pixels 4 wide and some 5, which reads as wobble rather than as craft. */
.mascot { --apx: calc(var(--fs) * ${PIXEL_EM}); display: block; width: calc(${INK_WIDTH} * var(--apx)); height: calc(${GRID_H} * var(--apx)) }
@supports (width: round(down, 1.5px, 1px)) { .mascot { --apx: round(down, calc(var(--fs) * ${PIXEL_EM}), 1px) } }
.m-text { fill: var(--text) } .m-accent { fill: var(--accent) } .m-muted { fill: var(--muted) }
.m-surface { fill: var(--surface) } .m-border { fill: var(--border) } .m-error { fill: var(--error) }

/* The still frame: what reduced motion, and a reader with CSS animation off, both see. */
.pose { opacity: 0 }
.p-${REST} { opacity: 1 }
.led-fault { opacity: 0 }
.br1 { opacity: 0 }
/* LEDs: the drawn pattern unless the state says otherwise, so an unknown state still looks like a rack. */
.led { opacity: 0 }
.led.drawn { opacity: 1 }
.mascot[data-telemetry="offline"] .led.act { opacity: 0 }
.mascot[data-telemetry="offline"] .led.pwr { opacity: 1 }
.bb { opacity: 0 }

@media (prefers-reduced-motion: no-preference) {
${poseKeyframes("idle", IDLE, IDLE_SECONDS)}
${poseKeyframes("alarm", ALARM, ALARM_SECONDS)}
@keyframes alarm-leds{0%{opacity:1}${pct(FAULT_UNTIL, ALARM_SECONDS)}{opacity:0}100%{opacity:0}}
${POSE_NAMES.map((n) => `.mascot .p-${n}{animation:idle-${n} ${IDLE_SECONDS}s step-end infinite}`).join("\n")}
${POSE_NAMES.map((n) => `.mascot.alarm .p-${n}{animation:alarm-${n} ${ALARM_SECONDS}s step-end 1 forwards}`).join("\n")}
.mascot.alarm .led-fault{animation:alarm-leds ${ALARM_SECONDS}s step-end 1 forwards}
@keyframes breath0{0%{opacity:1}${pct(BREATH.rest, BREATH.rest + BREATH.inhale)}{opacity:0}100%{opacity:0}}
@keyframes breath1{0%{opacity:0}${pct(BREATH.rest, BREATH.rest + BREATH.inhale)}{opacity:1}100%{opacity:1}}
.mascot .br0{animation:breath0 ${BREATH.rest + BREATH.inhale}s step-end infinite}
.mascot .br1{animation:breath1 ${BREATH.rest + BREATH.inhale}s step-end infinite}
${Array.from({ length: ZZZ_COUNT }, (_, i) => i).map((i) => {
  const cycle = ZZZ.step * ZZZ_COUNT + ZZZ.hold + ZZZ.gap;
  const on = i * ZZZ.step;
  const off = ZZZ.step * ZZZ_COUNT + ZZZ.hold;
  return `@keyframes zz${i}{0%{opacity:${on === 0 ? 1 : 0}}${on ? `${pct(on, cycle)}{opacity:1}` : ""}${pct(off, cycle)}{opacity:0}100%{opacity:0}}\n.mascot .zz${i}{animation:zz${i} ${cycle}s step-end infinite}`;
}).join("\n")}
${(() => { const { steps, burst } = bubbleSchedule(); return [...steps.map((s, k) => showDuring(`bb${k}`, [s], IDLE_SECONDS)), showDuring("bbx", [burst], IDLE_SECONDS)].join("\n"); })()}
/* LEDs by telemetry state. live: each activity LED on its own seeded flicker; stale: the drawn
   pattern, frozen (the still frame); offline: activity dark, power lights in a slow standby blink. */
${LEDS.map((l, k) => (l.power ? "" : showDuring(`flick${k}`, flickerPattern(k + 1, FLICKER_LOOP), FLICKER_LOOP, `.mascot[data-telemetry="live"] .led${k}`))).filter(Boolean).join("\n")}
@keyframes standby{0%{opacity:1}50%{opacity:0}100%{opacity:0}}
.mascot[data-telemetry="offline"] .led.pwr{animation:standby ${STANDBY}s step-end infinite}
/* The alarm is a held, fast sequence of its own: no breathing, no zZz, no bubble under it. */
.mascot.alarm .br0{animation:none;opacity:1}
.mascot.alarm .br1, .mascot.alarm .zz{animation:none;opacity:0}
.mascot.alarm .bb{animation:none;opacity:0}
.mascot.alarm .led{animation:none}
}
`.trim();
}
