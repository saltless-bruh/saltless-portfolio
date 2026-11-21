# Rack LEDs as the telemetry carrier — design (approved 2026-11-20)

## Intent

Settled 2026-10-06: the rack LEDs carry the operator box's telemetry state — *lit and cycling =
live, dark = offline; offline is the normal overnight state and must look intended; never the cat.*
The Worker and push script that produce telemetry do not exist yet. This change builds the LED
states now and shows the honest one (`offline`), so the Worker later only flips a value.

## Approaches

| | Today's LEDs | Verdict |
|---|---|---|
| **A** | All three states built; default `offline` (activity dark, power standby blink) | **Chosen.** Honest; same rule as the MOTD's placeholders; Worker becomes a switch. |
| B | Flicker always on | Claims "live" without data — breaks "never a fabricated number". |
| C | Worker + telemetry first | Much larger project; LEDs would wait on it. |

## Design

- **State:** `type Telemetry = "live" | "stale" | "offline"` in `src/telemetry.ts`, with
  `TELEMETRY_TODAY = "offline"`. `mascotSvg()` writes `data-telemetry` on the `<svg class="mascot">`.
  The client will set it from fetched data later (not in this change).
- **LEDs:** 12 single pixels — 3 units (rows 13, 18, 23) × columns 15, 17, 19, 21. The **power** LED is the leftmost
  column lit (`6`) in every unit — derived from the art (today x15); the rest are **activity**.
  The art's lit/dim pattern is the **drawn** pattern.
- **Looks:**
  - live — power steady lit; each activity LED flickers on its own stepped pattern (mostly on, short
    off blips), generated at build time from a fixed seed: deterministic, no two alike.
  - stale — drawn pattern, frozen.
  - offline — activity dark; power LEDs blink together in standby, 1 s on / 1 s off.
  - alarm — the existing red `led-fault` layer stays on top, unchanged.
- **Drawing:** every LED pixel painted `m-muted` in the rack base; each LED is its own `m-accent`
  path on top, switched by opacity. Tokens only.
- **Reduced motion:** the state's still form — offline: power lit, activity dark; live/stale: drawn.
- **Motion rule:** every animation `step-end`, opacity only.

## Non-goals

The Worker, the push script, `/top`, the window-bar glyph and MOTD values reading the state; the cat,
idle loop, bubble and alarm timing.

## Verification

Tests: default state `offline` written to the SVG; power derived = x15; 12 LEDs, 3 power; still forms
per state; activity patterns pairwise distinct and identical across builds; all animations stepped;
`led-fault` painted after every LED. Then `npm test`, `npm run typecheck`, `npm run build`, and a
headless pinned-frame check of live/offline.
