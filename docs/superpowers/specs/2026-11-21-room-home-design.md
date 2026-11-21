# The room: lazie.dev's home becomes the sleeping operator's bedroom (design, 2026-11-21)

## Intent

The owner's verdict on the shipped site: "a-okay, just a bit boring". The ask was to "bring it big",
with two references: a Framer pixel-art portfolio (a big pixel world, layered, lit) and omarchy.org
(mono everywhere, a huge banded wordmark, Everforest). The site is a fake terminal and a fake agent
CLI; the story that holds them together is the site's own line: *an offense person whose agents do
the work while he naps.*

So `/` stops opening on the terminal and opens on **the operator's bedroom at night**: he is asleep,
the cat is asleep on a server, the monitors are still running. The visitor is looking at his machine
while he sleeps. **Clicking the main monitor zooms into it and the screen becomes the shell**; the
second monitor is the agent CLI (`/napping`). The room is the reason the terminal exists, not a
picture above it.

## Goals

- A first screen with the presence of the references: one detailed, lit, layered pixel scene.
- The terminal stays the content and the router; the room is the way in.
- Nothing about the terminal, the agent CLI, the reader pages or the routes gets worse.

## Non-goals

- Day / dawn / dusk versions of the room. Night only: the operator is asleep. (Considered and
  dropped by the owner's choice.)
- A walkable room, hotspots on every object, or a desktop metaphor.
- Changing `/napping`, `/resume`, `/privacy`, `/contact`, `/ops/...` beyond what is listed here.

## Anti-goals (would be a failure even if it worked)

- A room that looks pasted together: anything in it that does not match the scene's art style. The
  owner rejected every hand-coded scene ("very scuff") and the flat mascot on the rack ("out of
  place"). Art comes from the generated scene, or is cut from it, or is re-lit to match it.
- A visitor who never finds the terminal.
- A slower page: the room must not cost the boot budget.

## Constraints (carried over, still binding)

- **Boot budget:** first paint ≤ 400 ms; the shell is live within ~1.2 s **of being entered**.
- **ADR 0001:** every screen is a real document; content is in the first response. The shell's rows
  stay in `/`'s HTML; the room is a layer over them, never a replacement.
- **Direct links unchanged:** `/resume`, `/ops/...`, `/napping` open straight into their page, no room.
- **Handle only** (ADR 0001): nothing in the room names the owner. The sign board stays blank.
- **Pixel style:** crisp edges, no smoothing, no blur, no glow haze; `image-rendering: pixelated`.
- **Assets-only Cloudflare Worker:** everything ships as static files.
- **Reduced motion** is honoured everywhere.
- **Licence:** PixelLab claims no rights over generated assets, trial accounts included, and asks for
  no attribution (checked 2026-11-21 via PixelLab's own help).

## Approaches considered

| | How the room and the terminal join | Verdict |
| --- | --- | --- |
| A | Room on top, terminal below; scroll or type to reach it | Easiest, but the room is decoration and many visitors never scroll |
| **B** | **Click the monitor: the camera zooms in and the screen becomes the shell** | **Chosen.** The room becomes the entrance; most memorable; uses the scene |
| C | Room as a dimmed backdrop, terminal floating over it | A window on a desktop, which this project ruled out early; text over a busy picture |

Within B, the owner chose **click to enter, no automatic zoom** ("it gives what we built more time
to be admired"), with Enter as the keyboard equivalent.

## What was decided

### The scene

- `art/room/scene-generated.png`: PixelLab `create_image_pro`, 320×180, Everforest Dark palette
  forced (25 colours), layout from a draft with the cat on a rack, lighting and the sleeping operator
  from another (job `d6ecb9f1-877c-4e98-86fd-fda2ee9e89da`). Contents: the operator asleep in bed with
  a lamp and nightstand; a blank sign board; a three-pane window onto a pine forest and full moon;
  fairy lights; a tower server and a mini PC; a desk with two monitors, keyboard, mug and an office
  chair; a plant; a wooden floor in perspective.
- `art/room/scene.png` is the shipped background: the generated scene with its small 3U rack painted
  out (wall colours, row by row) and **a copy of the room's own tower** placed at x 160, on the same
  floor line as the original (x 188–213, y 96–146), so the pair stands together under the window.

### The room's cat

- Cut from PixelLab candidate 4 of job `c7751a7e-65cf-4fcf-9fae-8ae0981d1824` (the cat only, not its
  rack, whose side panel faces the wrong way), set on top of the tower copy, tail over the front
  edge. Sprite origin in scene pixels: x 164, y 87; frame 23×18.
- **Re-lit dark ("first try"), the owner's pick:** body in the room's darkest greys (`#374145`,
  `#414b50`, `#4f5b58`), a dim moonlit rim on its back (`#7a8478` over `#56635f`), outline `#1e2326`.
- **Calm motion only:** breathing (the back rises one pixel on a 2.4 s cycle), a tail flick
  (~0.3 s every ~6.5 s), a dim `zZz` (`#56635f` fading to `#414b50`) drifting up from the head.
  Frames: `art/room/cat-sheet.png` = rest, breath, tail, breath+tail.
- **The original animated mascot, with the haywire gag, stays exactly as it is in `/napping`.** This
  amends the earlier "one mascot, site-wide" rule: one cat character, drawn two ways for two places.

### Entering

- On arrival `/` shows the room. Nothing zooms on its own.
- **The main monitor** (scene x 255–286, y 80–100) shows the shell waiting: a few short coloured
  lines and a blinking caret, with a slow pulse outlining the screen so it reads as the way in.
- A hint line under the scene: `click the monitor to wake the shell · or press Enter`.
- **Click the main monitor, or press Enter** → the room zooms into that monitor (~0.9 s,
  `cubic-bezier(.7,0,.2,1)`, a CSS transform on the room layer, crisp pixels) → the room layer
  fades and the shell, already in the page underneath, is live and focused.
- **Click the vertical monitor** (scene x 291–309, y 79–106) → the same zoom into it, then
  navigation to `/napping/`.
- **Arriving through the room always lands dark** (owner-confirmed): the room is night, so the shell
  entered from it uses the dark theme for that session regardless of `prefers-color-scheme`.
  Direct visits keep following the system theme.

### The ambient layer

A canvas over the scene at 320×180, scaled with the scene, drawn by the client script: the cat's
frames, the `zZz`, both towers' LEDs blinking, the main monitor's waiting prompt and pulse.
Everything else in the scene is the still PNG.

## Behaviour by case

| Case | What happens |
| --- | --- |
| First visit to `/` | Room, waiting for a click or Enter |
| Returning to `/` in the same session (e.g. `q` from `/resume`) | Straight into the shell, no room (my call: the room is an entrance, not a toll gate) |
| `exit` typed in the shell | Zooms back out to the room (my call: `exit` is the shell's own word for leaving) |
| Reduced motion | No zoom animation (a cut), no breathing, flicker or `zZz`; the room is a still |
| Narrow screens (portrait phones) | The room shows as a banner above a live shell; tapping the banner's monitor focuses the shell. No zoom. (My call: a 16:9 scene zoomed on a portrait screen crops away the point) |
| No JavaScript | The room image and, below it, the full prerendered shell rows; nothing is hidden |
| Screen readers | The room is one image with a written description; the shell's rows are in the DOM as today, so reading order is unchanged |

## Performance

- The scene is ~21 KB; the cat sheet is under 2 KB. The scene loads as an `<img>` with
  `fetchpriority="high"` and fixed dimensions (no layout shift). It is not inlined: `/`'s HTML
  already inlines the font subset and has the tightest budget.
- The canvas draws at 320×180, so the ambient layer costs almost nothing.

## Settled in the builder check (my calls, marked so the owner can veto)

- **Narrow means** a viewport narrower than 720 px or taller than it is wide.
- **Forcing dark** needs a theme override the stylesheet does not have today (it follows
  `prefers-color-scheme` only): a `data-theme="dark"` on `<html>` that wins over the media query,
  set for the session when the shell is entered through the room.
- **The two monitors are real buttons** (`<button>` over the hit areas, labelled "wake the shell" and
  "open napping"), so they are reachable by Tab and announced, not bare click regions.

## Left to the builder

- Exact markup and where the room layer, hint and canvas live in `src/html.ts` and the client.
- How the session flags (entered, dark) are stored; `sessionStorage`, guarded like the existing
  `lazie:booted` flag.
- The hint's exact copy may be tightened; it must name both the click and Enter.
- Tests: the room never removes the shell's rows from the document; the monitor hit areas match the
  scene coordinates above; `exit` and the session rule; reduced motion and narrow screens get no
  zoom; the build fails if a room asset is missing.

## Later, separate plans

The items approved earlier in this conversation become their own spec and plan after the room
ships, so this one stays buildable: Everforest colours by role across the terminal, the fastfetch
palette swatches, and sprites for the 404 page, `/resume`, `/privacy`, `/contact` and the favicon,
which will be made in the room's style.
