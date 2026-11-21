# Nose Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nose bubble that inflates across the cat's nap on `/napping` and pops at `yawn-in`.

**Architecture:** A pure schedule function derives the bubble's windows from `IDLE`; `mascotSvg()`
draws the stamps inside the existing breath groups; `mascotCss()` emits stepped opacity keyframes
on the 12 s idle period, wrapping across the loop seam.

**Tech Stack:** TypeScript on Node (`node --test`, type-stripping), CSS keyframes, inline SVG.

**Spec:** `docs/superpowers/specs/2026-11-20-nose-bubble-design.md`

## Global Constraints

- `IDLE` timings unchanged. Alarm, LEDs and page placement untouched.
- Colour only via token class `m-muted`; no hex, no inline `fill=`.
- Every running animation `step-end`; keyframes change opacity only.
- Nothing animates outside `@media (prefers-reduced-motion: no-preference)`; still frame hides the bubble.
- Stamps (x, y of top-left, rows; `1` = ink), copied from the profile's `src/mascot.ts:196-202`:
  step0 (21,7) `["1"]` · step1 (20,6) `["11","11"]` · step2 (19,5) `[" 1 ","1 1"," 11"]` ·
  step3 (19,5) `["111","1 1","111"]` · burst (17,4) `["  1  "," 1 1 ","1   1"," 1 1 ","  1  "]`.

## Review Focus

- A future `IDLE` edit that drops `yawn-in`, or leaves no dreaming window before it → must throw at build, not draw nothing (Task 1 test).
- Growth run crossing the loop seam → keyframes must show the bubble at t=0 (Task 2 test).
- Bubble drawn over the head after the inhale lift → overlap check must run on the lifted rows too (Task 2 test).
- Alarm class added later → bubble must not keep inflating over the alert pose (Task 2 test).
- `MAX_STILL` regression → existing test must still pass unchanged.

---

### Task 1: The bubble schedule

**Files:**
- Modify: `src/mascot.ts` (after `IDLE_SECONDS`)
- Test: `test/mascot.test.ts`

**Interfaces:**
- Produces: `export type Span = [from: number, to: number]` (seconds, `to` may exceed `IDLE_SECONDS` when it wraps) and
  `export function bubbleSchedule(idle: Window[] = IDLE): { steps: Span[]; burst: Span }`. Export `Window` type too.

- [ ] **Step 1: Write failing tests** `"the bubble grows across the nap and pops at yawn-in"`:
  `steps.length === 4`; `steps[0][0] ≈ 6.85`; `steps[3][1] ≈ 15.2` (= 3.2 + 12); steps contiguous and equal length (8.35/4);
  `burst ≈ [3.2, 3.35]`. And `"bubbleSchedule refuses a loop it cannot pop in"`: throws on an idle with no `yawn-in`,
  and on one where `yawn-in` is preceded by a non-dreaming pose.
- [ ] **Step 2:** `npm test` → those tests FAIL (not exported).
- [ ] **Step 3: Implement.** Find `yawn-in`; walk backwards cyclically while `DREAMING` includes the state, summing
  duration; growth `from = (yawnIn.from - total)`, normalised into `[0, IDLE_SECONDS)`, `to = from + total`; four equal steps.
  Burst = `[yawnIn.from, yawnIn.to]`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** commit `feat(mascot): derive the nose bubble's schedule from the idle loop`.

### Task 2: Draw and animate the bubble

**Files:**
- Modify: `src/mascot.ts` (`mascotSvg`, `mascotCss`)
- Test: `test/mascot.test.ts`

**Interfaces:**
- Consumes: `bubbleSchedule()`, `Span` from Task 1; existing `inhale`, `.br0/.br1` breath groups.
- Produces: SVG paths `class="m-muted bb bb0".."bb3"` and `"m-muted bb bbx"` inside `<g class="bubble"><g class="br0">…</g><g class="br1">…lifted 1px…</g></g>`, placed after the poses.

- [ ] **Step 1: Write failing tests:**
  `"the bubble is drawn in both breath phases"` — svg contains `bb0..bb3`, `bbx`, each twice.
  `"the bubble never touches the cat"` — for every idle window whose state is dreaming or `yawn-in`, and for both
  rest and `inhale()`d rows, no bubble pixel (lifted by the same 1 px in the inhale case) lands on a non-space cat
  cell, and none lands on a zZz pixel.
  `"the bubble keyframes wrap the loop seam"` — the `bb3` keyframes show opacity 1 at `0%`.
  `"still frame and alarm hide the bubble"` — before the media block `.bb { opacity: 0 }`; inside it
  `.mascot.alarm .bb{animation:none;opacity:0}`.
  Existing "every animation steps" and `MAX_STILL` tests stay as they are.
- [ ] **Step 2:** `npm test` → new tests FAIL.
- [ ] **Step 3: Implement.** Stamps → pixel lists via the existing `pixelPath`; lifted copy = `y - 1`.
  `showDuring(name, spans, total)` emits `@keyframes` from `[0, total)` on/off edges, splitting a span that ends past
  `total` into `[from,total)` + `[0,to-total)`; animate `.mascot .bbN` / `.bbx` for `IDLE_SECONDS` `step-end infinite`.
  The `br0/br1` classes already carry the breath animation, so the bubble groups inherit it.
- [ ] **Step 4:** `npm test` and `npm run typecheck` → PASS / clean.
- [ ] **Step 5: Frame check.** `npm run build`; in a browser on `/napping/`, pin
  `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T*1000 })` at T = 8, 10, 1, 2, 3.25, 5 and screenshot:
  steps 0, 1, 2, 3, the burst ring, and no bubble, respectively (step edges ≈ 6.85 / 8.94 / 11.03 / 13.11→1.11 / 3.2).
- [ ] **Step 6:** commit `feat(mascot): the nose bubble, popped by the yawn`.
