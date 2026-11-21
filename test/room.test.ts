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
