import type { Row } from "../rows.ts";
import { ls, cd, cat, displayPath, type Node } from "./fs.ts";

export type ScreenEntry = { cmd: string; blurb: string };
export type Cfg = {
  screens: ScreenEntry[];
  notFound: string;
  sudo: string[];
  hint: string;
  inputCol: number;
  /** The offense work as files, built from the repo's `ops/` folder. */
  fs: Node;
  emptyNote: string;
  /** The line `help` adds for the file commands, so visitors find ops/. */
  filesHelp: { cmd: string; blurb: string };
  /** The prompt's own path for the file system's top, `~/<login>`. */
  home: string;
};

export type Outcome =
  | { kind: "rows"; rows: Row[]; status: number; cwd?: string[] }
  | { kind: "go"; to: string }
  | { kind: "clear" }
  | { kind: "correct"; from: string; to: string }
  | { kind: "nothing" };

const line = (text: string, style?: Row["runs"][number]["style"]): Row => ({
  runs: [{ col: 0, text, style }],
});

/**
 * Edit distance where swapping two neighbouring letters costs one edit, not two (optimal string
 * alignment). Typing `hepl` for `help` is the commonest typo there is, and zsh's own spell checker
 * treats a transposition as cheap for the same reason. The strings are one shell word long.
 */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

export const BUILTINS = ["help", "ls", "cd", "cat", "pwd", "clear", "exit", "sudo"] as const;

/**
 * Near enough to mean, far enough not to be. Short words get one edit: at four letters, two edits
 * is half the word, which is how `nope` became `top`. Longer words get two.
 */
export const correctWithin = (typed: string): number => (typed.length <= 4 ? 1 : 2);

export function nearest(typed: string, known: string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const k of known) {
    const d = distance(typed, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  return bestD > 0 && bestD <= correctWithin(typed) ? best : undefined;
}

export function run(input: string, cfg: Cfg, cwd: string[] = []): Outcome {
  const typed = input.trim();
  if (!typed) return { kind: "nothing" };
  const word = typed.split(/\s+/)[0]!;
  // A path may hold spaces (`cat ops/My Writeup.md`), so a file command takes the rest of the line.
  const arg = typed.slice(word.length).trim() || undefined;
  const known = [...cfg.screens.map((s) => s.cmd), ...BUILTINS];

  if (word === "sudo") {
    return { kind: "rows", status: 1, rows: [line(cfg.sudo[0]!, "error"), line(cfg.sudo[1]!, "muted")] };
  }
  if (word === "clear") return { kind: "clear" };
  if (word === "exit" || word === "q") return { kind: "nothing" };
  if (word === "help" || word === "-h" || word === "--help" || word === "?") {
    const entries = [...cfg.screens, cfg.filesHelp];
    const pad = Math.max(...entries.map((s) => s.cmd.length)) + 2;
    return {
      kind: "rows",
      status: 0,
      rows: entries.map((s) => ({
        runs: [
          { col: 0, text: s.cmd, style: "accent" as const },
          { col: pad, text: s.blurb, style: "muted" as const },
        ],
      })),
    };
  }
  if (word === "ls") {
    const r = ls(cfg.fs, cwd, arg, cfg.emptyNote);
    if (r.error) return { kind: "rows", status: r.status, rows: [line(r.error, "error")] };
    if (r.note) return { kind: "rows", status: 0, rows: [line(r.note, "muted")] };
    const pad = Math.max(...r.entries.map((e) => e.length)) + 2;
    const rows: Row[] = [];
    // As many columns as fit the narrowest screen (40), at least one: the last entry needs only its own width.
    const per = Math.max(1, Math.floor((40 + 2) / pad));
    for (let i = 0; i < r.entries.length; i += per) {
      rows.push({ runs: r.entries.slice(i, i + per).map((e, j) => ({ col: j * pad, text: e, style: e.endsWith("/") ? "accent" as const : "text" as const })) });
    }
    return { kind: "rows", status: 0, rows };
  }
  if (word === "cd") {
    const r = cd(cfg.fs, cwd, arg);
    return r.error ? { kind: "rows", status: r.status, rows: [line(r.error, "error")] } : { kind: "rows", status: 0, rows: [], cwd: r.cwd };
  }
  if (word === "cat") {
    const r = cat(cfg.fs, cwd, arg);
    return r.go ? { kind: "go", to: r.go } : { kind: "rows", status: r.status, rows: [line(r.error!, "error")] };
  }
  if (word === "pwd") {
    return { kind: "rows", status: 0, rows: [line(cfg.home + displayPath(cwd).slice(1), "text")] };
  }
  const screen = cfg.screens.find((s) => s.cmd === word);
  if (screen) return { kind: "go", to: `/${screen.cmd}` };

  const did = nearest(word, known);
  if (did) return { kind: "correct", from: word, to: did };

  return {
    kind: "rows",
    status: 127,
    rows: [line(`zsh: command not found: ${word}`, "error"), line(cfg.notFound, "muted")],
  };
}
