import type { Content } from "./content.ts";
import type { Row, Run } from "./rows.ts";
import { bannerArt, bannerWidthCols } from "./banner.ts";

/** Structural marks: glyphs carrying no lexical content, so they belong to the generator. */
const OK = "[  OK  ]";
const FAILED = "[FAILED]";
const BRACKET_OPEN = "[";
const BRACKET_CLOSE = "]";

/** Where the Panel's values line up. The widest key plus a colon and a space. */
const panelValueCol = (keys: string[]): number => Math.max(...keys.map((k) => k.length)) + 2;

const blank = (): Row => ({ runs: [] });

/**
 * The MOTD: one `fastfetch` output with its logo on top. It prints on arrival and nothing invokes
 * it, which is the whole distinction between a masthead and a command.
 */
export function motdRows(c: Content): Row[] {
  const rows: Row[] = [];
  const art = bannerArt(c.handle);
  const markCols = bannerWidthCols(c.handle);

  // The version right-aligns to the MARK's width, not the grid's: it belongs to the mark, and
  // there is no second word beside it because the mark is the only word there is.
  rows.push({ runs: [{ col: Math.max(0, markCols - c.version.length), text: c.version, style: "muted" }] });
  for (const line of art) rows.push({ cls: "bn", runs: [{ col: 0, text: line }] });
  rows.push(blank());

  // The Panel is the persona, never the machine. Every value is a state or a joke.
  const panel: [string, string][] = [
    ["user", c.prompt.user],
    ["host", c.prompt.host],
    ["uptime", c.panel.uptime],
  ];
  const valueCol = panelValueCol(panel.map(([k]) => k));
  for (const [key, value] of panel) {
    const runs: Run[] = [
      { col: 0, text: `${key}:`, style: "accent" },
      { col: valueCol, text: value, style: "text" },
    ];
    rows.push({ runs });
  }
  rows.push(blank());

  // systemd-style, polychrome and ragged on purpose: one hue on aligned columns read as a web
  // layout in a mono font, and the `[FAILED]` line is the persona's own joke.
  for (const line of c.boot) {
    if (line.state === "note") {
      rows.push({ runs: [{ col: OK.length + 1, text: line.text, style: "muted" }] });
      continue;
    }
    const ok = line.state === "ok";
    const label = ok ? OK : FAILED;
    const inner = label.slice(1, -1);
    rows.push({
      cls: ok ? undefined : "boot-failed",
      runs: [
        { col: 0, text: BRACKET_OPEN, style: "muted" },
        { col: 1, text: inner, style: ok ? "accent" : "error" },
        { col: 1 + inner.length, text: BRACKET_CLOSE, style: "muted" },
        { col: label.length + 1, text: line.text, style: ok ? "text" : "error" },
      ],
    });
  }
  rows.push(blank());
  rows.push({ runs: [{ col: 0, text: c.lastLogin, style: "muted" }] });
  return rows;
}
