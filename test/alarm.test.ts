import { test } from "node:test";
import assert from "node:assert/strict";
import { wireAlarm, ALARM_EVERY } from "../src/client/alarm.ts";

/** Just enough of an SVGElement: listeners and a class list. */
function fakeSvg() {
  const on: Record<string, ((e: { animationName: string }) => void)[]> = {};
  const cls = new Set<string>();
  return {
    cls,
    addEventListener: (t: string, f: (e: { animationName: string }) => void) => { (on[t] ??= []).push(f); },
    classList: { add: (c: string) => cls.add(c), remove: (c: string) => cls.delete(c) },
    fire: (t: string, animationName: string) => on[t]?.forEach((f) => f({ animationName })),
  };
}

test("the rack goes haywire every few idle loops, the way the profile SVG's loop does", () => {
  const svg = fakeSvg();
  wireAlarm(svg);
  for (let i = 1; i < ALARM_EVERY; i++) svg.fire("animationiteration", "idle-sleep");
  assert.ok(!svg.cls.has("alarm"), "too early");
  svg.fire("animationiteration", "idle-sleep");
  assert.ok(svg.cls.has("alarm"), "the cat should be fixing the rack now");
});

test("the alarm ends when its own animation does, and the count starts over", () => {
  const svg = fakeSvg();
  wireAlarm(svg);
  for (let i = 0; i < ALARM_EVERY; i++) svg.fire("animationiteration", "idle-sleep");
  svg.fire("animationend", "alarm-leds");
  assert.ok(svg.cls.has("alarm"), "only the pose track's end closes it");
  svg.fire("animationend", "alarm-sleep");
  assert.ok(!svg.cls.has("alarm"));
  for (let i = 1; i < ALARM_EVERY; i++) svg.fire("animationiteration", "idle-sleep");
  assert.ok(!svg.cls.has("alarm"), "the next alarm waits a full count again");
});

test("other layers' loops (breathing, LEDs, zZz) do not count", () => {
  const svg = fakeSvg();
  wireAlarm(svg);
  for (let i = 0; i < ALARM_EVERY * 3; i++) {
    svg.fire("animationiteration", "breath0");
    svg.fire("animationiteration", "flick0");
    svg.fire("animationiteration", "idle-yawn");
  }
  assert.ok(!svg.cls.has("alarm"));
});
