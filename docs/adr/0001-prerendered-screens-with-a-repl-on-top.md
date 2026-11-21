# Every Screen is prerendered HTML, and the REPL is enhancement

Each of the six Screens is generated as its own HTML file at build time, carrying its own content.
The client script then attaches the REPL, tab completion, the panes, the Window Bar's keybindings and
the Boot timeline to that same DOM. The site is fully interactive; prerendering decides only what
arrives in the first response.

Two settled numbers force it. First paint is budgeted at 400 ms, and a direct route plays no Boot at
all, because a CV link to `/resume` must render the resume rather than boot a terminal first. A
client-rendered single-page app cannot satisfy either: `/resume` would arrive as an empty element
plus a bundle, which is the same time-to-content failure the profile already declined when it costed
a typed-replay animation at 8.5 s and dropped it (profile ADR 0004).

The side effect turned out to matter as much as the budget. Content that exists before JavaScript
runs is content `curl`, a crawler, a text browser and a reader with JavaScript off all receive, so
"every Command is a real URL" is true at the HTTP layer and not only in the History API. It also
answers the accessibility problem a fake terminal has: the established guidance for a full-screen
terminal interface is to provide a plain linear presentation alongside it, and here the prerendered
document *is* that presentation. There is no second accessible version to build or to let rot.

## Consequences

- **This retires the "no build step still holds" consequence recorded in the profile's ADR 0003.**
  A bundler now stands between source and what ships. Node 26 still runs `.ts` directly for the
  generator; the browser cannot, and that is the entire difference. esbuild is called from
  `build.ts` rather than run as its own tool, so the repository keeps one build entry point.
- **Two tsconfigs**, because the halves want opposite libraries: the generator takes `types:
  ["node"]` and no DOM, the client takes the DOM and no Node types at all. A stray `node:fs` import
  in client code then fails `npm run typecheck` instead of failing in a browser.
- **The Mascot's pose grids are parsed at build time** and ship as path data. `parseGrid` in
  `src/pixelart.ts` is the pure half that does it, and it never reaches the browser. This is also
  why `src/mascot.ts` was not copied from the profile: that module renders the profile's SVG
  document at the profile's fixed cell size, and this site renders to its own grid.
- **The budget is a gate, and the gate must throttle.** Localhost has no latency, so an
  unthrottled local measurement always passes and proves nothing. The profile's own research file
  already states the rule this follows from: measure the rendered result, not the source.
- **Every Screen must survive `COLS_NARROW`** (40 columns). A cell grid that technically fits at
  320 px while rendering 3 px glyphs has failed the same test as one that overflows.

## Considered Options

- **A single-page app with the History API.** One document, client-side routing, the terminal always
  live. Rejected: `/resume` arrives empty, 400 ms is unreachable, and the one path that must never
  wait on JavaScript is the shared link a hiring manager opens.
- **Prerendered with no client JavaScript at all.** Not a real option, since the REPL is the concept
  rather than a feature of it. Recorded because it is what each Screen degrades *to*, and that is
  the reason prerendering had to be the base layer rather than a fallback added afterwards.
