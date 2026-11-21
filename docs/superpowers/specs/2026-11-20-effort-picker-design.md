# `/effort` picker, rigged — design (approved 2026-11-20)

## Intent

The GitHub profile drew an agent CLI's effort menu as a picture: `lazy` past `xhigh`, and
`Ultrachill on · dynamic nap on every task`. On the site it can be used. The payoff is the
vibe-coded joke again: the controls work, the agent ignores them.

## Approaches

| | Enter / Tab | Verdict |
|---|---|---|
| A | choice honoured, a line per level; Ultrachill flips | a real picker with jokes |
| **B** | ▲ slides back to `lazy`; Ultrachill snaps back `on` | **Chosen.** Same joke as the pretend model; matches the persona's one state. |
| C | levels honoured, Ultrachill stuck | halfway |

## Design

- Typed `/effort` in `napping` opens a panel in place of the prompt; it owns the keyboard.
- ←/→ moves ▲ (starts on `lazy`, clamped). Enter: ▲ steps back to `lazy` (120 ms a step; reduced
  motion jumps), then the log gets `❯ /effort`, `● negotiating with the cat`,
  `╰ effort set to lazy. (you asked for <level>)` — or `effort set to lazy. great minds.` for `lazy`.
  Tab: `on` → `off` ~600 ms → `on`, note becomes `Ultrachill is load-bearing.` Esc:
  `╰ nothing changed. it's still lazy.` Tab never leaves the page.
- Touch: tapping a level picks and confirms; tapping `Ultrachill` toggles.
- Layout fits 40 columns: heading + `Faster ← → Smarter`; track; levels; `Ultrachill  on  Tab to
  toggle`; the note; help `←/→ adjust · Enter confirm · Esc cancel` (the profile's 48-column help
  line, trimmed to fit).
- `lazy` cycles accent → warning → error → text, Ultrachill alternates accent/text; both `step-end`,
  both off under reduced motion. Copy in `content.json` `napping.effort`. Boot unchanged; `/help`
  lists `/effort`.

## Verification

Pure-module tests (open, move, slide-back from every level, replies, 40-column fit, marker centred
on the selected level); `npm test`, `npm run typecheck`, `npm run build`; headless run with real keys.
