import test from "node:test";
import assert from "node:assert/strict";
import { PALETTES } from "../src/tokens.ts";
import { contrastRatio } from "../src/ramp.ts";
import { DREAMING } from "../src/timeline.ts";
import {
  POSES, POSE_NAMES, RACK_FROM, IDLE, ALARM, IDLE_SECONDS, ALARM_SECONDS,
  MASCOT_COLS, MASCOT_ROWS, mascotSvg, mascotCss, BREATH, MAX_STILL, inhale, ZZZ_COUNT,
  bubbleSchedule, BUBBLE_PIXELS, type Window, LEDS, flickerPattern,
} from "../src/mascot.ts";

const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} != ${b}`);

test("the bubble grows across the nap and pops at yawn-in", () => {
  const { steps, burst } = bubbleSchedule();
  assert.equal(steps.length, 4);
  near(steps[0]![0], 6.85, "inflation starts when she settles into the nap");
  near(steps[3]![1], 3.2 + IDLE_SECONDS, "inflation ends at the next lap's yawn-in");
  for (let k = 1; k < 4; k++) near(steps[k]![0], steps[k - 1]![1], `step ${k} is not contiguous`);
  for (const [a, b] of steps) near(b - a, 8.35 / 4, "steps are equal");
  near(burst[0], 3.2, "the pop is the jaw drop");
  near(burst[1], 3.35, "the burst lasts exactly yawn-in");
});

test("bubbleSchedule refuses a loop it cannot pop in", () => {
  const w = (state: string, from: number, to: number) => ({ state, from, to }) as Window;
  assert.throws(() => bubbleSchedule([w("sleep", 0, 2), w("yawn", 2, 3)]), /yawn-in/);
  assert.throws(() => bubbleSchedule([w("stretch", 0, 2), w("yawn-in", 2, 3)]), /sleeping window/);
});

test("every pose is 64 by 28, which is exactly 32 columns by 7 rows on the grid", () => {
  for (const n of POSE_NAMES) {
    assert.equal(POSES[n]!.rows.length, 28, n);
    for (const r of POSES[n]!.rows) assert.equal(r.length, 64, n);
  }
  assert.equal(MASCOT_COLS, 32);
  assert.equal(MASCOT_ROWS, 7);
  assert.ok(MASCOT_COLS <= 40, "she has to fit the narrow floor");
});

test("the rack is the same in every pose, which is what lets it be drawn once", () => {
  const rest = POSES.sleep!.rows.slice(RACK_FROM);
  for (const n of POSE_NAMES) assert.deepEqual(POSES[n]!.rows.slice(RACK_FROM), rest, n);
});

test("idle never contains the alarm, and loops on the pose it starts on", () => {
  assert.ok(!IDLE.some((e) => ["alert", "glare", "recover"].includes(e.state)), "the alarm leaked into the idle loop");
  assert.equal(IDLE[0]!.state, "sleep");
  assert.equal(IDLE.at(-1)!.state, "sleep", "a loop that ends on a different pose jumps when it wraps");
  assert.equal(IDLE[0]!.from, 0);
  assert.ok(IDLE_SECONDS <= 15, `the idle loop is ${IDLE_SECONDS}s; the user judged 28s "way too slow"`);
});

test("the alarm wakes, hits the rack, and goes back to sleep", () => {
  assert.equal(ALARM[0]!.state, "alert");
  assert.equal(ALARM[0]!.from, 0, "rebased to its own clock");
  assert.equal(ALARM.at(-1)!.state, "sleep");
  assert.ok(ALARM.some((e) => e.state === "swat-up") && ALARM.some((e) => e.state === "butt-up"));
  assert.equal(ALARM_SECONDS, 8);
});

test("windows are contiguous: no instant where no pose, or two poses, is shown", () => {
  for (const tl of [IDLE, ALARM]) {
    for (let i = 1; i < tl.length; i++) assert.equal(tl[i]!.from, tl[i - 1]!.to, `gap or overlap at ${tl[i]!.state}`);
  }
});

test("colour comes from tokens only: no hex literal reaches the artwork", () => {
  const svg = mascotSvg();
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(svg), "a hex colour in the SVG bypasses the theme");
  assert.ok(!/fill="/.test(svg), "an inline fill bypasses the theme");
  for (const n of POSE_NAMES) assert.ok(svg.includes(`class="pose p-${n}"`), n);
  assert.match(svg, /aria-label="[^"]+"/, "art drawn as geometry needs a text projection");
});

test("every animation steps: nothing interpolates between poses", () => {
  const css = mascotCss();
  // `animation:none` is how the alarm switches breathing off, which is correct; only a running
  // animation has a timing function to check.
  const uses = [...css.matchAll(/animation:[^;}]+/g)].map((m) => m[0]).filter((u) => u !== "animation:none");
  assert.ok(uses.length > 0);
  for (const u of uses) assert.match(u, /step-end/, `not stepped: ${u}`);
  const animated = [...css.matchAll(/\{opacity:[01]\}/g)].length;
  assert.ok(animated > 0);
  assert.ok(!/@keyframes[^{]+\{[^}]*(?:fill|width|height|left|top)\s*:/.test(css), "keyframes may move opacity and transform only");
});

test("reduced motion gets the still frame, not a slower animation", () => {
  const css = mascotCss();
  const head = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  assert.ok(!/animation:/.test(head), "an animation outside the no-preference block plays for everyone");
  assert.match(head, /\.p-sleep \{ opacity: 1 \}/, "the still frame is the sleeping cat");
});

// The art direction says to verify the cat reads against the rack in BOTH themes and report the
// figures rather than assume them. The previous hand-drawn version failed exactly here, at 1.13:1.
for (const theme of ["dark", "light"] as const) {
  test(`the cat reads against the rack, and the rack against the window (${theme})`, () => {
    const p = PALETTES[theme];
    const catOnRack = contrastRatio(p.text, p.surface);
    const frameOnWindow = contrastRatio(p.border, p.bg);
    const frameOnPanel = contrastRatio(p.border, p.surface);
    console.log(`  ${theme}: cat/rack ${catOnRack.toFixed(2)}:1  frame/window ${frameOnWindow.toFixed(2)}:1  frame/panel ${frameOnPanel.toFixed(2)}:1`);
    assert.ok(catOnRack >= 4.5, `cat merges into the rack at ${catOnRack.toFixed(2)}:1`);
    assert.ok(frameOnWindow >= 2.5, `the rack loses its silhouette at ${frameOnWindow.toFixed(2)}:1`);
  });
}

test("nothing on screen sits still for longer than MAX_STILL", () => {
  // The user's complaint, as a number: a 7.5s hold with no pixel moving read as an unanimated image.
  // Breathing runs under every idle pose, so the change instants are the pose cuts plus the breath.
  const period = BREATH.rest + BREATH.inhale;
  assert.ok(Math.abs(IDLE_SECONDS / period - Math.round(IDLE_SECONDS / period)) < 1e-9,
    "breath and pose loops must share a period, or the seam drifts every lap");
  const cuts = new Set<number>(IDLE.map((w) => Number(w.from.toFixed(3))));
  for (let t = 0; t < IDLE_SECONDS - 1e-9; t += period) {
    cuts.add(Number(t.toFixed(3)));
    cuts.add(Number((t + BREATH.rest).toFixed(3)));
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  let worst = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + IDLE_SECONDS;
    worst = Math.max(worst, next - sorted[i]!);
  }
  assert.ok(worst <= MAX_STILL + 1e-9, `${worst.toFixed(2)}s with nothing changing`);
});

test("the inhale lifts the body one pixel and leaves the belly on the rack, for every idle pose", () => {
  for (const w of IDLE) {
    const rows = POSES[w.state]!.rows.map((r, y) => (y < RACK_FROM ? r.replace(/1/g, " ") : r));
    const up = inhale(rows);
    assert.equal(up[RACK_FROM - 1], rows[RACK_FROM - 1], `${w.state}: the belly row moved`);
    assert.notDeepEqual(up.slice(0, RACK_FROM), rows.slice(0, RACK_FROM), `${w.state}: the inhale changed nothing`);
    assert.deepEqual(up.slice(RACK_FROM), rows.slice(RACK_FROM), `${w.state}: the rack breathed`);
  }
});

test("yawn-in is the jaw and only the jaw: three pixels on the bottom row", () => {
  const a = POSES.sleep!.rows, b = POSES["yawn-in"]!.rows;
  const diff: [number, number][] = [];
  a.forEach((r, y) => [...r].forEach((c, x) => { if (c !== b[y]![x]) diff.push([x, y]); }));
  assert.deepEqual(diff, [[26, 10], [27, 10], [28, 10]]);
});

test("dreaming poses build their zZz one shape at a time", () => {
  assert.equal(ZZZ_COUNT, 2, "the art draws a Z and a smaller z; if that changes, look at it");
  const svg = mascotSvg();
  for (let i = 0; i < ZZZ_COUNT; i++) assert.ok(svg.includes(`zz zz${i}`), `zZz shape ${i} missing`);
  const yawn = svg.slice(svg.indexOf('class="pose p-yawn"'), svg.indexOf("</g></g>", svg.indexOf('class="pose p-yawn"')));
  assert.ok(!yawn.includes("zz"), "an awake pose drew zZz");
});

test("the bubble is drawn in both breath phases", () => {
  const svg = mascotSvg();
  for (const c of ["bb0", "bb1", "bb2", "bb3", "bbx"]) {
    assert.equal(svg.split(`m-muted bb ${c}"`).length - 1, 2, `${c} must be drawn at rest and lifted`);
  }
});

test("the bubble never touches the cat or the zZz, at rest or mid-breath", () => {
  const all = [...BUBBLE_PIXELS.steps, BUBBLE_PIXELS.burst];
  const shown = new Set([...IDLE.filter((w) => DREAMING.includes(w.state as never)).map((w) => w.state), "yawn-in"]);
  for (const n of shown) {
    const rows = POSES[n]!.rows;
    const lifted = inhale(rows.map((r, y) => (y < RACK_FROM ? r.replace(/1/g, " ") : r)));
    for (const px of all) for (const { x, y } of px) {
      assert.equal(rows[y]![x], " ", `${n}: bubble pixel ${x},${y} lands on ink`);
      assert.equal(lifted[y - 1]![x], " ", `${n}: lifted bubble pixel ${x},${y - 1} lands on the inhaled cat`);
      assert.notEqual(rows[y - 1]![x], "1", `${n}: lifted bubble pixel ${x},${y - 1} lands on the zZz`);
    }
  }
});

test("the bubble keyframes wrap the loop seam", () => {
  const css = mascotCss();
  // Sample the loop and read each layer's opacity back out of its keyframes: exactly the step the
  // schedule names must be up, or none, at every instant, including either side of the seam.
  const { steps, burst } = bubbleSchedule();
  const kf = (name: string) => [...(css.match(new RegExp(`@keyframes ${name}\\{([^\\n]*)\\}\\n`))?.[1] ?? "")
    .matchAll(/([\d.]+)%\{opacity:([01])\}/g)].map((m) => [Number(m[1]) / 100 * IDLE_SECONDS, Number(m[2])] as const);
  const shownAt = (name: string, t: number) => kf(name).filter(([at]) => at <= t + 1e-9).at(-1)![1];
  const inSpan = ([a, b]: [number, number], t: number) => [t, t + IDLE_SECONDS].some((u) => a <= u && u < b);
  // Sampled between edges (keyframe percentages are rounded to 4 places, so an edge itself is fuzzy).
  for (let i = 0, t = 0.01; t < IDLE_SECONDS; t = 0.01 + ++i * 0.05) {
    steps.forEach((s, k) => assert.equal(shownAt(`bb${k}`, t), inSpan(s, t) ? 1 : 0, `bb${k} wrong at ${t.toFixed(2)}s`));
    assert.equal(shownAt("bbx", t), inSpan(burst, t) ? 1 : 0, `burst wrong at ${t.toFixed(2)}s`);
  }
});

test("still frame and alarm hide the bubble", () => {
  const css = mascotCss();
  const at = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  assert.match(css.slice(0, at), /\.bb \{ opacity: 0 \}/);
  assert.ok(css.slice(at).includes(".mascot.alarm .bb{animation:none;opacity:0}"));
});

test("the LEDs are read from the art", () => {
  assert.equal(LEDS.length, 12);
  assert.deepEqual([...new Set(LEDS.map((l) => l.y))].sort((a, b) => a - b), [13, 18, 23]);
  assert.deepEqual([...new Set(LEDS.map((l) => l.x))].sort((a, b) => a - b), [15, 17, 19, 21]);
  assert.deepEqual(LEDS.filter((l) => l.power).map((l) => l.x), [15, 15, 15], "power is the column lit in every unit");
  for (const l of LEDS) assert.equal(l.drawn, POSES.sleep!.rows[l.y]![l.x] === "6", `${l.x},${l.y}`);
});

test("the svg carries the LED look, blinking (live) by default", () => {
  assert.match(mascotSvg(), /<svg class="mascot"[^>]* data-telemetry="live"/);
  assert.match(mascotSvg("offline"), /data-telemetry="offline"/);
});

test("every LED is its own layer, under the alarm", () => {
  const svg = mascotSvg();
  const at = [...svg.matchAll(/class="m-accent led led\d+ /g)].map((m) => m.index!);
  assert.equal(at.length, 12);
  const fault = svg.indexOf("led-fault");
  for (const i of at) assert.ok(i < fault, "an LED paints over the alarm's red");
  const rack = svg.slice(svg.indexOf('<g class="rack">'), svg.indexOf("</g>", svg.indexOf('<g class="rack">')));
  assert.ok(!rack.includes("m-accent"), "the rack base must paint every LED dim");
});

test("LED still forms: drawn pattern by default, offline is power only", () => {
  const css = mascotCss();
  const head = css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"));
  assert.match(head, /\.led \{ opacity: 0 \}/);
  assert.match(head, /\.led\.drawn \{ opacity: 1 \}/);
  assert.match(head, /\.mascot\[data-telemetry="offline"\] \.led\.act \{ opacity: 0 \}/);
  assert.match(head, /\.mascot\[data-telemetry="offline"\] \.led\.pwr \{ opacity: 1 \}/);
});

test("live: activity LEDs flicker, each its own way", () => {
  const css = mascotCss();
  const bodies = LEDS.flatMap((l, k) => (l.power ? [] : [css.match(new RegExp(`@keyframes flick${k}\\{([^\\n]*)\\}\\n`))?.[1]]));
  assert.equal(bodies.length, LEDS.filter((l) => !l.power).length);
  for (const b of bodies) assert.ok(b, "an activity LED has no flicker");
  assert.equal(new Set(bodies).size, bodies.length, "two activity LEDs blink in sync");
  LEDS.forEach((l, k) => {
    if (!l.power) assert.ok(css.includes(`.mascot[data-telemetry="live"] .led${k}{animation:flick${k} 6s step-end infinite}`), `led${k} not driven when live`);
  });
  for (let seed = 1; seed <= 20; seed++) {
    const on = flickerPattern(seed, 6);
    const lit = on.reduce((s, [a, b]) => s + (b - a), 0);
    assert.ok(lit >= 3, `seed ${seed}: on only ${lit.toFixed(2)}s of 6s`);
    on.forEach(([, b], i) => {
      const next = i + 1 < on.length ? on[i + 1]![0] : on[0]![0] + 6;
      assert.ok(next - b <= 0.3 + 1e-9, `seed ${seed}: an off blip of ${(next - b).toFixed(2)}s`);
      assert.ok(next - b >= 0.08 - 1e-9, `seed ${seed}: an off blip too short to see`);
    });
  }
});

test("offline: power LEDs blink in standby together", () => {
  const css = mascotCss();
  assert.ok(css.includes("@keyframes standby{0%{opacity:1}50%{opacity:0}100%{opacity:0}}"));
  assert.ok(css.includes('.mascot[data-telemetry="offline"] .led.pwr{animation:standby 2s step-end infinite}'));
  assert.ok(!/data-telemetry="offline"\] \.led\.act\{animation/.test(css), "offline activity LEDs must stay dark");
});

test("LED patterns are the same on every build", () => {
  assert.equal(mascotCss(), mascotCss());
  assert.deepEqual(flickerPattern(1, 6), flickerPattern(1, 6));
  assert.notDeepEqual(flickerPattern(1, 6), flickerPattern(2, 6));
});

test("the alarm freezes the LEDs so its red covers every lit one", () => {
  const css = mascotCss();
  assert.ok(css.includes(".mascot.alarm .led{animation:none}"), "a live LED would flicker green through the alarm");
});
