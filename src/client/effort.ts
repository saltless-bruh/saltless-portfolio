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
  toggleHint: string;
  help: string;
  call: string;
  /** `{level}` is replaced with what was asked for. */
  reply: string;
  replyLazy: string;
  cancel: string;
  loadBearing: string;
};

export type EffortState = { at: number; ultrachill: "on" | "off"; note: string };

/** Where the scale sits: indented two columns, levels two apart, so five of them fit in 40. */
const SCALE_COL = 2;
const GAP = 2;
const WIDTH = 40;

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

/** Each level's starting column. */
function levelCols(c: EffortCfg): number[] {
  const cols: number[] = [];
  let col = SCALE_COL;
  for (const l of c.labels) { cols.push(col); col += len(l) + GAP; }
  return cols;
}

export function effortRows(c: EffortCfg, s: EffortState): Row[] {
  const cols = levelCols(c);
  const end = cols.at(-1)! + len(c.labels.at(-1)!);
  // The marker over the middle of the selected word (left of centre when the word is even).
  const marker = cols[s.at]! + Math.floor((len(c.labels[s.at]!) - 1) / 2);
  const ends = `${c.ends.start} ← → ${c.ends.end}`;

  const track: Run[] = [];
  if (marker > SCALE_COL) track.push({ col: SCALE_COL, text: "─".repeat(marker - SCALE_COL), style: "muted" });
  track.push({ col: marker, text: "▲", style: "accent" });
  if (end > marker + 1) track.push({ col: marker + 1, text: "─".repeat(end - marker - 1), style: "muted" });

  const levels: Run[] = c.labels.map((l, i) => ({
    col: cols[i]!, text: l,
    style: i === s.at ? "accent-bold" : "muted",
    cls: ["eff-lv", `eff-lv-${i}`, i === lazyAt(c) ? "eff-lazy" : ""].filter(Boolean).join(" "),
  }));

  const stateCol = len(c.toggleWord) + 2;
  return [
    { cls: "eff", runs: [{ col: 0, text: c.word, style: "accent" }, { col: WIDTH - len(ends), text: ends, style: "muted" }] },
    { cls: "eff", runs: track },
    { cls: "eff", runs: levels },
    { cls: "eff", runs: [
      { col: 0, text: c.toggleWord, style: "accent", cls: "eff-toggle eff-ultra" },
      { col: stateCol, text: s.ultrachill, style: s.ultrachill === "on" ? "accent-bold" : "error" },
      { col: stateCol + 5, text: c.toggleHint, style: "muted" },
    ] },
    { cls: "eff", runs: [{ col: 0, text: s.note, style: "muted" }] },
    { cls: "eff", runs: [{ col: 0, text: c.help, style: "muted" }] },
  ];
}
