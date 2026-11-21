# Shell boot — design (approved 2026-11-20)

Owner's budget (Oct): first paint ≤ 400 ms, prompt live ≤ 1.5 s, any key skips, direct routes and
reduced motion never boot, once per tab, the boot only reveals what the document already holds.

**Approaches (what it types):** A `ls ops` (the evidence) · **B `help` (chosen by the owner: the
map)** · C `cd ops` + `ls` (two commands, tight).

**Design:** wordmark at first paint; MOTD lines every 50 ms from 60 ms; echoed prompt, `help` typed
at 30 ms a letter; help rows every 35 ms; prompt live at the schedule's end (≈ 1.2 s), asserted
≤ 1.5 s by test. Elements are hidden only by their own `boot-in` animation (backwards fill), so no
animation means everything shows; any keydown/pointerdown `finish()`es them (the key still types);
2.5 s safety timer. Gate: inline script sets `<html class="booting">` before first paint when
`lazie:booted` is unset and reduced motion is off. CSS, no anime.js on `/`.
