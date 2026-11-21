import { PALETTES } from "./tokens.ts";
import { gridCss, GUTTER_PX, maxContentPx, COLS_WIDE } from "./grid.ts";

import { bandedFill, RAMP } from "./wordmark.ts";
import { mascotCss, MASCOT_COLS } from "./mascot.ts";

const themeVars = (theme: "dark" | "light"): string => {
  const p = PALETTES[theme];
  return [
    `--bg: ${p.bg}`, `--surface: ${p.surface}`, `--border: ${p.border}`,
    `--text: ${p.text}`, `--muted: ${p.muted}`, `--accent: ${p.accent}`,
    `--warning: ${p.warning}`, `--error: ${p.error}`,
    `--f-bg: ${RAMP.bg}`,
  ].join("; ");
};

/**
 * The font is INLINED as a data URI rather than fetched. The grid's column maths assume JetBrains
 * Mono's 0.6em advance, so a fallback face does not merely look different, it lays out wrong; and
 * the block glyphs the wordmark is built from are absent from most monospace fallbacks, where they
 * render as .notdef boxes. A subset of only the characters this site can display is small enough
 * to inline, which removes the request and with it the window where the wrong font is on screen.
 */
export function css(fontWoff2Base64: string): string {
  return `
@font-face {
  font-family: "JetBrains Mono";
  src: url(data:font/woff2;base64,${fontWoff2Base64}) format("woff2");
  font-weight: 400; font-style: normal; font-display: block;
}
:root { ${themeVars("dark")}; --gutter: ${GUTTER_PX}px; --bands: ${bandedFill("dark")}; color-scheme: dark light }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { ${themeVars("light")}; --f-bg: ${PALETTES.light.bg}; --bands: ${bandedFill("light")} } }
:root[data-theme="light"] { ${themeVars("light")}; --f-bg: ${PALETTES.light.bg}; --bands: ${bandedFill("light")} }

* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body {
  background: var(--bg);
  color: var(--text);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-synthesis: none;
  font-variant-ligatures: none;
}

${gridCss()}

/* A run states the column it starts at, so two runs cannot drift apart when the cell resizes.
   The LAST run of a row stays in flow and wraps, which is what a real terminal does when a line is
   longer than the window: at 40 columns a boot message has to go somewhere, and truncating it is
   the one thing a terminal never does. Everything before it overlays absolutely, so the structure
   (the bracket, the key, the sigil) stays on the first line where it belongs. */
.row { position: relative; min-height: var(--cell-h); white-space: pre }
.row > span { position: absolute; top: 0; left: calc(var(--c) * var(--cell-w)) }
.row > span:last-child {
  position: static;
  display: block;
  margin-left: calc(var(--c) * var(--cell-w));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.text { color: var(--text) }
.muted { color: var(--muted) }
.accent { color: var(--accent) }
.warning { color: var(--warning) }
.error { color: var(--error) }
.bold, .accent-bold { font-weight: 700 }
.accent-bold { color: var(--accent) }

/* The mark. Width comes from the text itself, so the bands land on the glyphs and not on the page. */
/* The mark is art, not a line of prose: it never wraps, and it must size to its own content or
   the gradient box stretches to the row and the bands land on the page instead of on the glyphs. */
.bn > span, .bn > span:last-child {
  position: static;
  display: inline-block;
  width: max-content;
  margin-left: 0;
  white-space: pre;
  color: transparent;
  background-image: var(--bands);
  -webkit-background-clip: text;
  background-clip: text;
}

/* The prompt's live half. A real input, visually hidden, so a phone raises its keyboard and a
   screen reader finds something to type into; the visible caret is drawn, not a native one. */
.io { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0 }
/* The caret is one cell and never wraps, so it opts out of the last-run rule above. */
.row > span.caret, .row > span.caret:last-child {
  position: absolute;
  display: inline-block;
  margin-left: 0;
  left: calc(var(--c) * var(--cell-w));
  width: var(--cell-w);
  height: var(--cell-h);
  white-space: pre;
}
/* Kali's right prompt: the last failure's exit status, pinned to the row's right edge. */
.row > span.rprompt, .row > span.rprompt:last-child { position: absolute; left: auto; right: 0; margin-left: 0; white-space: pre }
.caret { background: var(--accent); color: var(--bg); animation: blink 1.06s step-end infinite }
@keyframes blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .caret { animation: none } }
/* The reader: a writeup from ops/, rendered. Real HTML for readability (tables, images, wrapping),
   dressed in the terminal: one face, the palette, hard edges, no rounded corners. */
.md { max-width: 80ch; white-space: normal; line-height: 1.6 }
.md h1, .md h2, .md h3 { color: var(--accent); font-weight: 700; font-size: 1em; margin: 1.6em 0 .4em }
.md h1 { margin-top: .6em; border-bottom: 1px solid var(--border); padding-bottom: .2em }
.md h1::before { content: "# " ; color: var(--muted) } .md h2::before { content: "## "; color: var(--muted) }
.md h3::before { content: "### "; color: var(--muted) }
.md p, .md ul, .md ol, .md table, .md figure, .md aside, .md blockquote { margin: 0 0 1em }
.md a { color: var(--accent); text-underline-offset: 3px }
.md code { color: var(--warning) }
.md strong { color: var(--text); font-weight: 700 }
.md ul { padding-left: 2ch; list-style: "- " }
.md table { border-collapse: collapse }
.md th, .md td { border: 1px solid var(--border); padding: 0 1ch; text-align: left }
.md th { color: var(--accent) }
.md img { max-width: 100%; border: 1px solid var(--border); image-rendering: auto }
.md-code { border: 1px solid var(--border); margin-inline: 0 }
.md-code figcaption { color: var(--muted); border-bottom: 1px solid var(--border); padding: 0 1ch }
.md-code pre { margin: 0; padding: .5em 1ch; overflow-x: auto; white-space: pre }
.md-code code { color: var(--text) }
.md blockquote { border-left: 2px solid var(--border); padding-left: 1.5ch; color: var(--muted) }
.callout { border-left: 2px solid var(--muted); padding: .2em 1.5ch; background: var(--surface) }
.callout-title { color: var(--muted); font-weight: 700; margin: 0 0 .3em }
.callout-danger, .callout-bug, .callout-failure { border-color: var(--error) } .callout-danger .callout-title, .callout-bug .callout-title, .callout-failure .callout-title { color: var(--error) }
.callout-warning, .callout-caution { border-color: var(--warning) } .callout-warning .callout-title, .callout-caution .callout-title { color: var(--warning) }
.callout-tip, .callout-success, .callout-note, .callout-info { border-color: var(--accent) } .callout-tip .callout-title, .callout-success .callout-title, .callout-note .callout-title, .callout-info .callout-title { color: var(--accent) }
/* /effort: the profile's rainbow on lazy and shimmer on Ultrachill, stepped like everything else. */
.eff-lv, .eff-toggle { cursor: pointer }
@keyframes eff-rainbow { 0% { color: var(--accent) } 25% { color: var(--warning) } 50% { color: var(--error) } 75% { color: var(--text) } }
@keyframes eff-shimmer { 0% { color: var(--accent) } 50% { color: var(--text) } }
@media (prefers-reduced-motion: no-preference) {
  .eff-lazy { animation: eff-rainbow 1.2s step-end infinite }
  .eff-ultra { animation: eff-shimmer .9s step-end infinite }
}

.term:focus-visible, .io:focus { outline: none }
.term[data-focus="off"] .caret { animation: none; opacity: .35 }

.term { padding-bottom: calc(var(--cell-h) * 3) }
/* man's status line, pinned to the bottom in reverse video, the way less draws it. */
.pager {
  position: fixed; left: var(--gutter); bottom: calc(var(--cell-h) * .5);
  background: var(--text); color: var(--bg); text-decoration: none; white-space: pre;
}
.pager:hover, .pager:focus-visible { background: var(--accent); outline: none }

/* napping, shaped like an agent CLI. Boxes are drawn the way a terminal UI draws them, one cell of
   padding inside a rounded hairline, and every box shares the same small radius. */
.agent .welcome, .agent .box {
  border: 1px solid var(--border); border-radius: 6px;
  padding: calc(var(--cell-h) * .5) var(--cell-w);
}
.agent .welcome { border-color: var(--accent); margin-bottom: var(--cell-h) }
/* The input band: pinned to the window's bottom, the conversation scrolling above it. The client
   keeps the term's bottom padding equal to the band's height, which grows with the menu. */
#band {
  position: fixed; left: var(--gutter); right: var(--gutter); bottom: 0;
  background: var(--bg); padding-block: calc(var(--cell-h) * .5);
}
.agent .box { padding-block: calc(var(--cell-h) * .25) }
.term.agent { padding-bottom: calc(var(--cell-h) * 5) }
/* Your own turn, set apart on a faint strip, the way an agent CLI shades the user's message. */
.agent .row.you { background: var(--surface) }
/* /effort opens in the input box's place: the same full-width box, lit while it owns the keyboard,
   its fixed-column block centred and never wider than the box. */
#effort { border-color: var(--accent); padding-block: calc(var(--cell-h) * .5) }
#effort .effort-in { margin-inline: auto; max-width: 100% }
#menu { padding-block: calc(var(--cell-h) * .25) }
#menu .item { cursor: pointer }
#menu .item.sel { background: var(--surface) }
.agent .status { margin-top: calc(var(--cell-h) * .25) }
@container screen (max-width: 520px) { .agent .status .wide { display: none } }

/* The agent's startup: the Mascot with the startup block beside her, the way an agent CLI prints
   its mark and its version side by side. Below roughly ${MASCOT_COLS + 30} columns there is no room for
   both, and the block drops underneath instead of crushing either. A flex wrap, not a breakpoint,
   because the answer depends on the content's width and not on the device. */
.agent-head { display: flex; flex-wrap: wrap; align-items: center; column-gap: calc(var(--cell-w) * 3); row-gap: var(--cell-h) }
.agent-head .startup { flex: 1 1 calc(var(--cell-w) * 30); min-width: 0 }

${mascotCss()}

a { color: var(--accent) }
.max { max-width: ${maxContentPx(COLS_WIDE).toFixed(0)}px }
`.trim();
}
