# Nose bubble on `/napping` — design (approved 2026-11-20)

## Intent

The 12 s idle loop was approved ("look great now, does feel smooth"). The nose bubble finishes the
nap story the art direction already asks for, and it is the one remaining mascot piece every visitor
sees. The alarm stays reserved for the first Finding (user decision, same day).

## The problem it solves

The profile's bubble popped at `alert`. The site's idle loop has no alarm, so that pop point does
not exist here.

## Approaches

| | Pop moment | Verdict |
|---|---|---|
| **A** | At `yawn-in` — the jaw drop pops it | **Chosen.** Cause and effect, reads as a gag. The dreaming run wraps the loop seam; one CSS schedule on the 12 s period handles it. |
| B | On its own at the end of the nap | Unmotivated; lands on the loop seam and exposes it. |
| C | Never pops, hidden on wake | Contradicts ART-DIRECTION ("must not blink out"). |

## Design

- **Art:** the profile's stamps, unchanged coordinates (the site's `sleep` grid is byte-identical to
  the profile's): four growth steps from one pixel at x21 row 7 to a 3×3 ring at x19–21 rows 5–7,
  and a 5×5 burst ring at x17–21 rows 4–8. Token `muted`, same as the zZz.
- **Timing, derived not hard-coded:** the growth window is the run of `DREAMING` windows walked
  backwards (cyclically, across the loop seam) from `yawn-in`. With today's `IDLE` that is
  6.85 s → 15.2 s (= 3.2 s next lap), 8.35 s in four equal steps. The burst shows for the whole
  `yawn-in` window (0.15 s), then nothing.
- **Breathing:** the bubble lifts 1 art px on the inhale, with the face. Implemented by drawing it
  in the existing `br0` / `br1` breath groups.
- **Peek:** the bubble stays up (peek is a dreaming pose).
- **Reduced motion / no CSS animation:** bubble hidden in the still frame, like the inhale.
- **Alarm:** bubble hidden while `.mascot.alarm` plays *(builder's call: the alarm is unwired and
  out of scope; the alert pose does not show a bubble).*
- **Every keyframe steps** (`step-end`), opacity only — the site's motion rule.

## Non-goals

No change to `IDLE` timings, the alarm, the LEDs, or which page shows the cat.

## Verification

Tests: bubble only during dreaming poses; growth is four equal contiguous steps ending exactly at
`yawn-in`'s start; burst spans exactly `yawn-in`; no bubble pixel overlaps cat ink in any pose it
is drawn over, or the zZz; still frame hides it; all animations stepped; `MAX_STILL` still holds.
Then `npm test`, `npm run typecheck`, `npm run build`, and a frame check by pinning animations with
the Web Animations API.
