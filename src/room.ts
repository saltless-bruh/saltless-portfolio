/**
 * The room: `/`'s entrance, the sleeping operator's bedroom (docs/superpowers/specs/
 * 2026-11-21-room-home-design.md). Everything here is in SCENE pixels, the 320x180 grid the art
 * was drawn on, so it stays true at any size the page draws the scene.
 */
export const SCENE = { w: 320, h: 180 } as const;

export type Rect = { x: number; y: number; w: number; h: number };

/** The two screens on the desk: the main one wakes the shell, the vertical one opens napping. */
export const MONITORS: { main: Rect; side: Rect } = {
  main: { x: 255, y: 80, w: 31, h: 20 },
  side: { x: 291, y: 79, w: 18, h: 27 },
};

/** The room's cat on its tower: the sprite's top-left, one frame's size, and its frame count. */
export const CAT = { x: 164, y: 87, w: 23, h: 18, frames: 4 } as const;

/** The tower's LEDs, then the same six on its copy, 28 px to the left. */
const TOWER_LEDS: [number, number][] = [[197, 100], [197, 104], [197, 108], [206, 100], [206, 104], [206, 112]];
export const LEDS: [number, number][] = [...TOWER_LEDS, ...TOWER_LEDS.map(([x, y]): [number, number] => [x - 28, y])];

/** What the build copies from art/room/ to dist/room/. */
export const ROOM_ASSETS = ["scene.png", "cat-sheet.png"] as const;

/**
 * The transform that zooms the room layer into a monitor: the monitor's centre lands on the
 * window's centre, and it is scaled until its screen covers the whole window. `room` is the
 * layer's box as it sits unzoomed; the result is applied with `transform-origin: 0 0`.
 */
export function zoomTransform(m: Rect, room: { left: number; top: number; width: number }, view: { width: number; height: number }): { tx: number; ty: number; s: number } {
  const px = room.width / SCENE.w;
  const s = Math.max(view.width / (m.w * px), view.height / (m.h * px)) * 1.02;
  const cx = (m.x + m.w / 2) * px, cy = (m.y + m.h / 2) * px;
  return { tx: view.width / 2 - room.left - cx * s, ty: view.height / 2 - room.top - cy * s, s };
}

/** Breathing: the back is raised for the second half of every 2.4 s cycle. */
const BREATH = 2.4;
/** The tail flicks for 0.3 s every 6.5 s. */
const FLICK = 6.5, FLICK_FOR = 0.3;

/** The cat-sheet frame at a moment: 0 rest, 1 breath, 2 tail, 3 breath and tail. */
export function catFrame(sec: number): 0 | 1 | 2 | 3 {
  const breath = sec % BREATH >= BREATH / 2 ? 1 : 0;
  const flick = sec % FLICK < FLICK_FOR ? 2 : 0;
  return (breath + flick) as 0 | 1 | 2 | 3;
}

/** Narrow: a phone, or any window taller than it is wide. The room is a banner there, never an overlay. */
export const NARROW = "(max-width: 719.98px), (max-aspect-ratio: 999/1000)";

/** Where a click on a monitor leads, and whether the camera moves to get there. */
export function planEnter(which: "main" | "side", reduced: boolean): { animate: boolean; then: "shell" | "/napping/" } {
  return { animate: !reduced, then: which === "main" ? "shell" : "/napping/" };
}
