import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, renameSync } from "node:fs";
import { SCENE, MONITORS, CAT, LEDS, zoomTransform, catFrame, ROOM_ASSETS } from "../src/room.ts";
import { loadContent } from "../src/content.ts";

const inside = (r: { x: number; y: number; w: number; h: number }) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= SCENE.w && r.y + r.h <= SCENE.h;

test("the two monitors sit where the scene draws them", () => {
  assert.deepEqual(SCENE, { w: 320, h: 180 });
  assert.deepEqual(MONITORS.main, { x: 255, y: 80, w: 31, h: 20 });
  assert.deepEqual(MONITORS.side, { x: 291, y: 79, w: 18, h: 27 });
  assert.ok(inside(MONITORS.main) && inside(MONITORS.side));
  assert.deepEqual(CAT, { x: 164, y: 87, w: 23, h: 18, frames: 4 });
  assert.ok(LEDS.length === 12 && LEDS.every(([x, y]) => x >= 0 && x < 320 && y >= 0 && y < 180), "six LEDs on each tower");
});

test("zooming into a monitor centres it and fills the window with it", () => {
  const room = { left: 0, top: 0, width: 1440 };
  const view = { width: 1440, height: 810 };
  const px = 1440 / 320;
  const m = MONITORS.main;
  const { tx, ty, s } = zoomTransform(m, room, view);
  const cx = (m.x + m.w / 2) * px, cy = (m.y + m.h / 2) * px;
  assert.ok(Math.abs(tx + cx * s - 720) < 0.5, "centred across");
  assert.ok(Math.abs(ty + cy * s - 405) < 0.5, "centred down");
  assert.ok(s * m.w * px >= 1440 && s * m.h * px >= 810, "the screen covers the whole window");
  const off = zoomTransform(m, { left: 37, top: 12, width: 1000 }, { width: 1100, height: 700 });
  const pxo = 1000 / 320;
  assert.ok(Math.abs(37 + off.tx + (m.x + m.w / 2) * pxo * off.s - 550) < 0.5, "a room that does not start at the corner still centres");
});

test("the cat breathes every 2.4 s and flicks its tail every 6.5 s", () => {
  assert.equal(catFrame(0.5), 0, "at rest");
  assert.equal(catFrame(1.5), 1, "breath in: the second half of the cycle");
  assert.equal(catFrame(13.1), 2, "a tail flick while breathing out (13.1 mod 2.4 = 1.1)");
  assert.equal(catFrame(6.6), 3, "a flick that lands mid-breath shows both (6.6 mod 2.4 = 1.8)");
  assert.equal(catFrame(3.0), 0, "no flick between flicks");
  for (let t = 0; t < 30; t += 0.05) assert.ok([0, 1, 2, 3].includes(catFrame(t)));
});

test("the build ships the room's art, and fails loudly without it", async () => {
  const { build } = await import("../src/build.ts");
  await build();
  for (const name of ROOM_ASSETS) assert.ok(existsSync(new URL(`../dist/room/${name}`, import.meta.url)), `dist/room/${name} missing`);
  const art = new URL("../art/room/scene.png", import.meta.url), away = new URL("../art/room/scene.png.away", import.meta.url);
  renameSync(art, away);
  try {
    await assert.rejects(build(), /art\/room\/scene\.png is missing/);
  } finally {
    renameSync(away, art);
  }
  await build();
});

test("the room's words say how to get in, without a dash", () => {
  const r = loadContent().room;
  assert.match(r.hint, /monitor/);
  assert.match(r.hint, /Enter/);
  assert.ok(r.alt.length > 30 && r.wake && r.napping);
  for (const v of Object.values(r)) assert.ok(!/[—–]/.test(v), v);
});

/** Runs an inline gate script against a stub page; returns the classes it put on <html>. */
async function gate(opts: { entered?: boolean; narrow?: boolean; reduced?: boolean; booted?: boolean }): Promise<string[]> {
  const { ROOM_GATE } = await import("../src/html.ts");
  const { BOOT_GATE } = await import("../src/boot.ts");
  const classes = new Set<string>();
  const doc = { documentElement: { classList: { add: (c: string) => classes.add(c), contains: (c: string) => classes.has(c) } } };
  const store: Record<string, string> = { ...(opts.entered ? { "lazie:entered": "1" } : {}), ...(opts.booted ? { "lazie:booted": "1" } : {}) };
  const sessionStorage = { getItem: (k: string) => store[k] ?? null };
  const matchMedia = (q: string) => ({ matches: q.includes("reduced-motion") ? !!opts.reduced : !!opts.narrow });
  for (const tag of [ROOM_GATE, BOOT_GATE]) {
    const js = tag.replace(/^<script>/, "").replace(/<\/script>$/, "");
    new Function("document", "sessionStorage", "matchMedia", js)(doc, sessionStorage, matchMedia);
  }
  return [...classes].sort();
}

test("the gate puts the room up on a wide screen for a tab that has not entered, and holds the boot back", async () => {
  assert.deepEqual(await gate({}), ["room"]);
  assert.deepEqual(await gate({ reduced: true }), ["room"], "reduced motion still gets the room, as a still");
  assert.deepEqual(await gate({ entered: true }), ["booting", "entered"], "entered this session: straight into the shell, which boots as before");
  assert.deepEqual(await gate({ entered: true, booted: true }), ["entered"]);
  assert.deepEqual(await gate({ narrow: true }), ["booting"], "narrow: no overlay; the banner sits above a shell that boots as before");
});

test("the room layer comes before the shell and takes none of its rows away", async () => {
  const { shellHtml } = await import("../src/html.ts");
  const c = loadContent();
  const html = shellHtml(c, "", { dir: true, kids: {} });
  const room = html.indexOf('id="room"'), main = html.indexOf("<main");
  assert.ok(room > 0 && room < main, "the room layer opens the page, before <main>");
  const rows = (h: string) => [...h.matchAll(/<div class="row[^"]*">[\s\S]*?<\/div>/g)].map((m) => m[0]);
  const shell = html.slice(main);
  assert.ok(rows(shell).length > 20, "the MOTD, the help exchange and the prompt are still in the document");
  for (const needle of ["Started", "motivation.service", "resume", "napping", "the offense work"]) assert.ok(shell.includes(needle), needle);
});

test("the monitors are labelled buttons, placed where the scene draws them", async () => {
  const { shellHtml } = await import("../src/html.ts");
  const c = loadContent();
  const html = shellHtml(c, "", { dir: true, kids: {} });
  for (const [which, label] of [["main", c.room.wake], ["side", c.room.napping]] as const) {
    const b = new RegExp(`<button class="room-mon" data-mon="${which}" aria-label="${label}" style="([^"]+)"`).exec(html);
    assert.ok(b, `${which} button`);
    const m = MONITORS[which];
    for (const part of [`left:calc(${m.x}/320*100%)`, `top:calc(${m.y}/180*100%)`, `width:calc(${m.w}/320*100%)`, `height:calc(${m.h}/180*100%)`]) assert.ok(b![1]!.includes(part), `${which}: ${part}`);
  }
  assert.ok(html.includes(c.room.hint), "the hint is on the page");
});

test("review focus 5: the scene has fixed dimensions, loads first, and is described", async () => {
  const { shellHtml } = await import("../src/html.ts");
  const c = loadContent();
  const img = /<img class="room-scene"[^>]*>/.exec(shellHtml(c, "", { dir: true, kids: {} }))![0];
  for (const attr of ['src="/room/scene.png"', 'width="320"', 'height="180"', 'fetchpriority="high"', `alt="${c.room.alt}"`]) assert.ok(img.includes(attr), attr);
});

test("the overlay is only for wide screens; pixels stay crisp; the layer is dark while the scene loads", async () => {
  const { css } = await import("../src/css.ts");
  const s = css("");
  const wide = /@media \(min-width: 720px\) and \(min-aspect-ratio: 1\/1\) \{([\s\S]*?)\n\}/.exec(s);
  assert.ok(wide, "a wide-screen block");
  assert.match(wide![1]!, /html\.room \.room-layer \{[^}]*position: fixed/);
  assert.match(wide![1]!, /html\.entered \.room-layer \{[^}]*display: none/);
  assert.doesNotMatch(s.replace(wide![0], ""), /html\.room \.room-layer \{[^}]*position: fixed/, "no overlay outside the wide block");
  assert.match(s, /\.room-scene, #room-fx \{[^}]*image-rendering: pixelated/);
  assert.match(s, /\.room-layer \{[^}]*background: #1e2326/);
});

test("only / has a room: direct links open straight into their page", async () => {
  const { screenHtml, nappingHtml, notFoundHtml } = await import("../src/html.ts");
  const c = loadContent();
  for (const page of [screenHtml(c, "", "resume"), screenHtml(c, "", "privacy"), nappingHtml(c, ""), notFoundHtml(c, "")]) {
    assert.ok(!page.includes('id="room"') && !page.includes("lazie:entered"), "no room off the home page");
  }
});

test("entering: the main monitor wakes the shell, the side one opens napping; reduced motion cuts", async () => {
  const { planEnter } = await import("../src/room.ts");
  assert.deepEqual(planEnter("main", false), { animate: true, then: "shell" });
  assert.deepEqual(planEnter("side", false), { animate: true, then: "/napping/" });
  assert.deepEqual(planEnter("main", true), { animate: false, then: "shell" });
});

test("the gate's idea of narrow is the exact opposite of the overlay's wide block", async () => {
  const { NARROW } = await import("../src/room.ts");
  const { ROOM_GATE } = await import("../src/html.ts");
  assert.equal(NARROW, "(max-width: 719.98px), (max-aspect-ratio: 999/1000)");
  assert.ok(ROOM_GATE.includes(NARROW));
});

test("review focus 1: a session that entered through the room stays dark on every page, before first paint", async () => {
  const { shellHtml, screenHtml, nappingHtml, notFoundHtml, THEME_GATE } = await import("../src/html.ts");
  const c = loadContent();
  for (const page of [shellHtml(c, "", { dir: true, kids: {} }), screenHtml(c, "", "resume"), nappingHtml(c, ""), notFoundHtml(c, "")]) {
    const head = page.slice(0, page.indexOf("<body>"));
    assert.ok(head.includes(THEME_GATE), "every page reads the session's theme in its head");
  }
  const set: Record<string, string> = {};
  const doc = { documentElement: { dataset: set } };
  const run = (stored: Record<string, string>) => new Function("document", "sessionStorage", THEME_GATE.replace(/^<script>/, "").replace(/<\/script>$/, ""))(doc, { getItem: (k: string) => stored[k] ?? null });
  run({});
  assert.equal(set.theme, undefined, "a direct visit keeps the system theme");
  run({ "lazie:dark": "1" });
  assert.equal(set.theme, "dark");
});
