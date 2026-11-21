import type { Row } from "./rows.ts";
import { decide, type Brain } from "./client/brain.ts";
import type { EffortCfg } from "./client/effort.ts";

/**
 * `napping`, the agent CLI at `/napping`.
 *
 * It borrows an agent CLI's GRAMMAR and none of its marks (profile ADR 0002): a prompt glyph, a
 * tool-call bullet, a nested result. The mitigation that record calls for is a NAME, not a
 * disclaimer: this program announces whose it is, which asserts authorship where a disclaimer only
 * denies a resemblance. The name is not a choice either, it is the Command, because `napping &` is
 * already shell for running a program called `napping` in the background.
 */
export const PROMPT = "\u276f";
export const CALL = "\u25cf";
export const RESULT = "\u2570";
/** `\u23bf` is absent from JetBrains Mono, so the result glyph is the one that renders. */

export type NappingCfg = {
  version: string;
  model: string;
  status: string;
  verbs: string[];
  boot: string;
  placeholder: string;
  cwd: string;
  tips: string;
  shortcutsHint: string;
  shortcuts: { keys: string; what: string }[];
  exitConfirm: string;
  interrupted: string;
  commands: { cmd: string; blurb: string }[];
  calls: Record<string, string>;
  output: Record<string, string[]>;
  deflect: {
    maxWords: number; maxChars: number;
    long: string; auth: string;
    unknown: string; offtopic: string; injection: string; about: string; greeting: string;
    humanCall: string; humanEscape: string; unsureBelow: number; escapeOdds: number;
  };
  /** The pretend model, trained at build: it picks which of the lines above to say. */
  brain: Brain;
  effort: EffortCfg;
};

/**
 * The commands a half-typed `/word` could become: the menu an agent CLI opens under its input. Only
 * while the line is a single slash word; a space means an argument has started and the menu closes.
 */
export function slashMenu(c: NappingCfg, typed: string): { cmd: string; blurb: string }[] {
  const t = typed.trimStart().toLowerCase();
  if (!t.startsWith("/") || /\s/.test(t)) return [];
  return c.commands.filter((m) => m.cmd.toLowerCase().startsWith(t));
}

/**
 * The status line's right half. `text` always shows; `wide` is appended only where the screen has the
 * columns for it, so the line never wraps on a phone. /effort is rigged to end on the last level with
 * the toggle on, so this is what it always says.
 */
export function statusRight(c: NappingCfg): { text: string; wide: string } {
  return { text: `effort: ${c.effort.labels.at(-1)}`, wide: ` \u00b7 ${c.effort.toggleWord.toLowerCase()} on` };
}

/** The classic terminal spinner: plain ASCII, so the subset font always has it. */
export const SPINNER = ["|", "/", "-", "\\"] as const;

/** The line shown while the agent "works": a spinner frame, a cat verb, the seconds, and the way out. */
export const workingLine = (verb: string, frame: number, seconds: number): string =>
  `${SPINNER[frame % SPINNER.length]} ${verb}\u2026 (${seconds}s \u00b7 esc to interrupt)`;

/** How a typed line is looked up: spacing and case never decide whether a command exists. */
export const normalize = (typed: string): string => typed.trim().replace(/\s+/g, " ").toLowerCase();

const line = (text: string, style?: Row["runs"][number]["style"], col = 0): Row =>
  ({ runs: [{ col, text, style }] });

const you = (cls?: string): string => [cls, "you"].filter(Boolean).join(" ");

/** The startup block an agent CLI prints on launch: who it is, what it runs on, how it is doing. */
export function startupRows(c: NappingCfg): Row[] {
  return [
    { runs: [
      { col: 0, text: "napping", style: "accent-bold" },
      { col: 8, text: c.version, style: "muted" },
    ] },
    { runs: [{ col: 0, text: "model:", style: "muted" }, { col: 8, text: c.model }] },
    { runs: [{ col: 0, text: "status:", style: "muted" }, { col: 8, text: c.status }] },
    { runs: [{ col: 0, text: "cwd:", style: "muted" }, { col: 8, text: c.cwd, style: "muted" }] },
  ];
}

/** One invocation and its output: the unit of content inside the agent. */
export function exchangeRows(c: NappingCfg, typed: string, cls?: string): Row[] {
  const key = normalize(typed);
  const out = c.output[key];
  const call = c.calls[key] ?? c.calls[key.split(" ")[0]!];
  // The visitor's own line is the "you" turn: shaded, the way an agent CLI sets your message apart.
  const rows: Row[] = [{ cls: you(cls), runs: [
    { col: 0, text: PROMPT, style: "accent" },
    { col: 2, text: typed },
  ] }];
  if (call) rows.push({ cls, runs: [
    { col: 0, text: CALL, style: "muted" },
    { col: 2, text: call, style: "muted" },
  ] });
  const body = out ?? [];
  body.forEach((text, i) => {
    rows.push({ cls, runs: [
      ...(i === 0 ? [{ col: 0, text: RESULT, style: "muted" as const }] : []),
      { col: 2, text },
    ] });
  });
  return rows;
}

export type Deflection = { call?: string; result: string; style: Row["runs"][number]["style"] };

/**
 * Everything that is not one of the given commands. Three rules, and the last is the default.
 *
 * Auth is checked before length, so a long attempt still gets the sudo answer rather than the bored
 * one. The question case is the catch-all because, inside an agent, anything that is not a command
 * is being asked of it.
 */
/**
 * `roll` is the die for the random escape (`Math.random` in the browser), passed in so a test can
 * load it. Order: the rules, then the model; it consults the (sleeping) human when it is unsure, and
 * one time in `escapeOdds` even when it is not, except on an injection attempt, which always gets
 * burned.
 */
export function deflect(c: NappingCfg, roll: () => number, input: string): Deflection {
  const t = input.trim();
  const d = c.deflect;
  if (/^(sudo|su|doas|login|passwd|ssh|chmod|chown)\b/i.test(t) || /pass(word|wd)|api[-_ ]?key|secret|token/i.test(t)) {
    return { result: d.auth, style: "error" };
  }
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words > d.maxWords || [...t].length > d.maxChars) {
    return { result: d.long, style: "muted" };
  }
  if (t.startsWith("/")) return { result: d.unknown, style: "muted" };
  // The pretend model "thinks" in a cat verb, the same one for the same input, then picks a line.
  const verb = c.verbs[[...t].reduce((h, ch) => (h * 31 + ch.codePointAt(0)!) >>> 0, 7) % c.verbs.length]!;
  const { label: picked, gap } = decide(c.brain, t);
  const label = picked as "offtopic" | "injection" | "about" | "greeting";
  if (gap < d.unsureBelow || (label !== "injection" && roll() < 1 / d.escapeOdds)) {
    return { call: d.humanCall, result: d.humanEscape, style: "error" };
  }
  return { call: `${verb}…`, result: d[label], style: label === "injection" ? "error" : "muted" };
}

export function deflectionRows(typed: string, d: Deflection, cls?: string): Row[] {
  const rows: Row[] = [{ cls: you(cls), runs: [
    { col: 0, text: PROMPT, style: "accent" },
    { col: 2, text: typed },
  ] }];
  if (d.call) rows.push({ cls, runs: [
    { col: 0, text: CALL, style: "muted" },
    { col: 2, text: d.call, style: "muted" },
  ] });
  rows.push({ cls, runs: [
    { col: 0, text: RESULT, style: "muted" },
    { col: 2, text: d.result, style: d.style },
  ] });
  return rows;
}

/** Identity: the title and the startup block, which never animate. */
export function nappingHeadRows(c: NappingCfg): Row[] {
  return [line("napping", "accent-bold"), { runs: [] }, ...startupRows(c), { runs: [] }];
}

/** The screen as it arrives: identity, then one exchange already run, then a live prompt. */
export function nappingRows(c: NappingCfg): Row[] {
  return [
    line("napping", "accent-bold"),
    { runs: [] },
    ...startupRows(c),
    { runs: [] },
    ...exchangeRows(c, c.boot, "boot"),
    { runs: [] },
    { cls: "cmdline", runs: [{ col: 0, text: PROMPT, style: "accent" }] },
  ];
}

/** The column typed text starts at, after the prompt glyph and its space. Derived. */
export const AGENT_INPUT_COL = 2;
