// COPIED from saltless-bruh/saltless-bruh @ f0a0e06, 2026-10-06. The profile repo keeps its own
// copy and its own tests; neither follows the other. Both were frozen when this was taken, so
// there is no sync mechanism on purpose: if this file changes here, it changes because THIS
// site's needs changed. See docs/adr/0001.
//
// ADAPTED. Two sections. Below are the profile's fixed SVG units, retained because `blockart.ts`
// computes path geometry from them and `banner.ts` draws through it; they are the inherited tests'
// numbers and nothing on the site lays out with them. The site's own cell grid is at the bottom of
// the file, and it is fluid.

/**
 * The column counts the site reflows between. A terminal already has this concept: content
 * written for 80 columns degrades honestly at 40. Every screen must survive COLS_NARROW,
 * because a cell grid that merely fits at 320px while rendering 3px glyphs has still failed.
 */
export const COLS_WIDE = 81;
export const COLS_MID = 60;
export const COLS_NARROW = 40;
// JetBrains Mono v2.304 is exactly monospace: unitsPerEm 1000, advance 600 = 0.6em.
// font-size 20 therefore gives a cell exactly 12 units wide, with no rounding.
export const FONT_SIZE = 20;
export const CELL_W = 12;
/**
 * THE ROW PITCH IS LOCKED TO TWICE THE COLUMN, AND THAT IS STRUCTURAL RATHER THAN A CHOICE.
 *
 * `src/mascot.ts` builds the sprite from art pixels of `PX = CELL_W / 2` and refuses to load unless
 * `PX === CELL_H / 4`, because an art pixel that is not square is not a pixel. Those two together
 * say `CELL_H = 2 * CELL_W` and nothing else. The consequence worth writing down, because it is the
 * thing somebody will try: the line-height ratio is therefore fixed at `CELL_H / FONT_SIZE = 1.2`,
 * at every font size and every column count, so **extra leading cannot be bought at any scale**.
 * Raising `CELL_H` alone breaks the sprite's squareness check; raising it together with `CELL_W`
 * holds the ratio at 1.2 and changes only the absolute size. Measured by breaking it.
 */
export const CELL_H = 2 * CELL_W;
/**
 * Columns the Session is drawn in.
 *
 * 84, and the number is a measurement rather than a preference. The README column is ~846px
 * (docs/spec.md 3.1), and a `viewBox` with no fixed width scales the whole canvas into it, so the
 * column count sets the rendered text size: 846px over a 72-column canvas renders the 20-unit font
 * at **18.9px**, where a terminal is 13 to 15px. That is why the Session read as huge and cramped
 * at 72. At 84 it renders at **16.3px**, and the existing line lengths still nearly fill the row.
 *
 * **96 was built and rendered beside 84 and rejected by the owner**, not on size, which it also
 * gets right, but because the copy was written for 72 and does not grow with the grid: at 96 the
 * rows end well short of the margin and the panel opens a visible dead strip on the right. 84 is
 * the widest setting the existing copy still fills.
 */
export const COLS = 84;
export const PAD = 16;
// Centres the x-height (550/1000 em = 11 units) in the 24-unit row, and stays 17.5 after the
// Task 3 render check. Centring the cap height (730/1000 em = 14.6 units) would need 19.3 and
// leave a descender (3.6 units) only 1.1 units clear of the row's bottom edge instead of 2.9.
// The gap from a descender to the next row's tallest printable ink ('$', 17.4 units) is 3.0
// units at any baseline, because it depends only on the 24-unit row pitch.
export const BASELINE_IN_ROW = 17.5;
export const CANVAS_W = PAD + COLS * CELL_W + PAD;

export const colX = (col: number): number => PAD + col * CELL_W;
export const rowBaselineY = (row: number): number => PAD + row * CELL_H + BASELINE_IN_ROW;
export const canvasH = (rows: number): number => PAD + rows * CELL_H + PAD;

// ---------------------------------------------------------------------------
// The site's cell grid. Fluid cell, fixed column count per breakpoint.
// ---------------------------------------------------------------------------

/**
 * JetBrains Mono's advance as a fraction of the em. MEASURED, not chosen: unitsPerEm 1000 with an
 * advance of 600, which is where `FONT_SIZE 20` / `CELL_W 12` above comes from.
 */
export const ADVANCE = CELL_W / FONT_SIZE;

/**
 * The row pitch as a fraction of the em, and it is STRUCTURAL rather than typographic taste.
 * `CELL_H = 2 * CELL_W` is forced by the sprite's square-pixel check (see CELL_H above), so this
 * ratio is 1.2 at every font size and every column count. Two consequences worth stating because
 * both get attempted: extra leading cannot be bought at any scale, and an art pixel stays exactly
 * square at all three breakpoints without anything having to maintain it.
 */
export const LINE = CELL_H / FONT_SIZE;

/** Rendered text below this is legible-in-theory only. Asserted, no longer a clamp input. */
export const MIN_FONT_PX = 11;
/**
 * The rendered size, constant at every viewport. 14px because this project already measured the
 * range: the note on COLS above records that 18.9px "read as huge and cramped", and that a
 * terminal is 13 to 15px. `FONT_SIZE` above is 20 SVG USER UNITS, not pixels, and treating it as
 * pixels is how the first build shipped a 20px terminal.
 */
export const FONT_PX = 14;
/** One gutter each side. */
export const GUTTER_PX = 16;

/** The authoring tiers. Only the floor is enforced; the rest is whatever the window holds. */
export const COLUMN_COUNTS = [COLS_WIDE, COLS_MID, COLS_NARROW] as const;

/** Where the content stops growing, which is the width the copy is authored against. */
export const maxContentPx = (cols: number): number => cols * FONT_PX * ADVANCE;

/**
 * The narrowest container that still shows `cols` columns at the full size. Derived, so the one
 * place a size is decided stays one place.
 */
export const minContainerPx = (cols: number): number => cols * FONT_PX * ADVANCE + 2 * GUTTER_PX;

/** How many columns a container of this width actually shows at the full size. */
export const colsIn = (containerPx: number): number =>
  Math.floor((containerPx - 2 * GUTTER_PX) / (FONT_PX * ADVANCE));

/**
 * The grid's stylesheet.
 *
 * A TERMINAL KEEPS ITS FONT AND CHANGES ITS COLUMN COUNT. The first version did the reverse, fixing
 * the columns at 81 and scaling the type to fit, then centring the block; that is how a web page
 * behaves, and in a mono font it reads as a web page in a mono font. So the size is constant, the
 * column count is whatever the window happens to hold, and the whole thing is anchored top left
 * where a shell starts printing.
 *
 * The one concession: below `minContainerPx(COLS_NARROW)` the size does shrink, because the
 * alternative is losing columns the content is authored to need. A phone at 320px lands at 12px,
 * which still clears the legibility floor.
 */
export function gridCss(): string {
  return [
    `.screen { container: screen / inline-size; padding: ${GUTTER_PX}px; min-height: 100dvh }`,
    // The bar is a sibling of the terminal, not a child, so it has to be named here too or it
    // inherits the browser's default size and silently stops being on the grid.
    `.term, .bar {`,
    `  --fs: min(${FONT_PX}px, calc((100cqw - ${2 * GUTTER_PX}px) / ${COLS_NARROW} / ${ADVANCE}));`,
    `  --cell-w: calc(var(--fs) * ${ADVANCE});`,
    `  --cell-h: calc(var(--fs) * ${LINE});`,
    `  font-size: var(--fs);`,
    `  line-height: ${LINE};`,
    `}`,
  ].join("\n");
}
