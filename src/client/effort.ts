import type { Row, Run } from "../rows.ts";

/**
 * `/effort`, the GitHub profile's effort menu made usable, and rigged: the controls work and the
 * agent ignores them. Whatever level is picked, the marker walks back to `lazy`; Ultrachill turns
 * off for a moment and comes back on. Pure: the state, the moves and the rows. `agent.ts` owns keys,
 * taps and timers.
 */
export type EffortCfg = {
  word: string;
  ends: { start: string; end: string };
  labels: string[];
  toggleWord: string;
  toggleNote: string;
  help: string;
  call: string;
  /** `{level}` is replaced with what was asked for. */
  reply: string;
  replyLazy: string;
  cancel: string;
  loadBearing: string;
};

export type EffortState = { at: number; ultrachill: "on" | "off"; note: string };

/** The scale's width in columns: the narrowest screen, so it never has to reflow on a phone. */
export const SCALE_WIDTH = 40;

const lazyAt = (c: EffortCfg): number => c.labels.indexOf("lazy");

export const openEffort = (c: EffortCfg): EffortState => ({ at: lazyAt(c), ultrachill: "on", note: c.toggleNote });

export const move = (c: EffortCfg, s: EffortState, dir: -1 | 1): EffortState =>
  ({ ...s, at: Math.min(c.labels.length - 1, Math.max(0, s.at + dir)) });

/** The levels the marker passes through on its way back to `lazy`, in order, `lazy` last. */
export function slideBack(c: EffortCfg, from: number): number[] {
  const to = lazyAt(c);
  const steps: number[] = [];
  for (let i = from + 1; i <= to; i++) steps.push(i);
  return steps;
}

export const confirmReply = (c: EffortCfg, picked: number): string =>
  (picked === lazyAt(c) ? c.replyLazy : c.reply.replace("{level}", c.labels[picked]!));

const len = (s: string): number => [...s].length;

/** Each level's starting column: first at the left edge, last ending at the right, gaps even. */
function levelCols(c: EffortCfg): number[] {
  const n = c.labels.length;
  const free = SCALE_WIDTH - c.labels.reduce((t, l) => t + len(l), 0);
  const cols: number[] = [];
  let col = 0;
  c.labels.forEach((l, i) => {
    cols.push(col);
    col += len(l) + Math.floor(free / (n - 1)) + (i < free % (n - 1) ? 1 : 0);
  });
  return cols;
}

const centred = (text: string): number => Math.max(0, Math.floor((SCALE_WIDTH - len(text)) / 2));

/**
 * The picker in three parts, the way an agent CLI lays one out: the title at the left, the scale
 * as a fixed-width block the page centres, and the key hints at the bottom left.
 */
export function effortPanel(c: EffortCfg, s: EffortState): { title: Row[]; scale: Row[]; help: Row[] } {
  const cols = levelCols(c);
  // The marker over the middle of the selected word (left of centre when the word is even).
  const marker = cols[s.at]! + Math.floor((len(c.labels[s.at]!) - 1) / 2);

  const track: Run[] = [];
  if (marker > 0) track.push({ col: 0, text: "\u2500".repeat(marker), style: "muted" });
  track.push({ col: marker, text: "\u25b2", style: "accent" });
  if (SCALE_WIDTH > marker + 1) track.push({ col: marker + 1, text: "\u2500".repeat(SCALE_WIDTH - marker - 1), style: "muted" });

  const levels: Run[] = c.labels.map((l, i) => ({
    col: cols[i]!, text: l,
    style: i === s.at ? "accent-bold" : "muted",
    cls: ["eff-lv", `eff-lv-${i}`, i === lazyAt(c) ? "eff-lazy" : ""].filter(Boolean).join(" "),
  }));

  // Ultrachill, centred as if its state were always three letters, so on/off never shifts the word.
  const toggleAt = centred(`${c.toggleWord}  off`);
  return {
    title: [{ cls: "eff", runs: [{ col: 0, text: c.word, style: "accent-bold" }] }],
    scale: [
      { cls: "eff", runs: [
        { col: 0, text: c.ends.start, style: "text" },
        { col: SCALE_WIDTH - len(c.ends.end), text: c.ends.end, style: "text" },
      ] },
      { cls: "eff", runs: track },
      { cls: "eff", runs: levels },
      { cls: "eff", runs: s.note ? [{ col: centred(s.note), text: s.note, style: "muted" }] : [] },
      { runs: [] },
      { cls: "eff", runs: [
        { col: toggleAt, text: c.toggleWord, style: "accent", cls: "eff-toggle eff-ultra" },
        { col: toggleAt + len(c.toggleWord) + 2, text: s.ultrachill, style: s.ultrachill === "on" ? "accent-bold" : "error" },
      ] },
    ],
    help: [{ cls: "eff", runs: [{ col: 0, text: c.help, style: "muted" }] }],
  };
}

/** The whole panel as one list of rows, in reading order. */
export function effortRows(c: EffortCfg, s: EffortState): Row[] {
  const p = effortPanel(c, s);
  return [...p.title, ...p.scale, ...p.help];
}
