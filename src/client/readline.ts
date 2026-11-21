/**
 * The prompt's line editing, as zsh does it under Kali's `.zshrc` (kali-defaults, checked
 * 2026-11-20). Pure, so it is tested from Node; `shell.ts` only wires keys and storage to it.
 */

/**
 * Tab on the first word. One match fills it in with a space; several extend the line to their
 * shared prefix and list them, as zsh's auto-list does. An empty line lists every command, a
 * deliberate departure: zsh would insert a tab, which on a page means nothing.
 */
export function complete(input: string, known: readonly string[]): { line: string; list: string[] } {
  if (/\s/.test(input)) return { line: input, list: [] };
  const hits = [...new Set(known.filter((k) => k.startsWith(input)))].sort();
  if (hits.length === 0) return { line: input, list: [] };
  if (hits.length === 1) return { line: `${hits[0]} `, list: [] };
  let prefix = hits[0]!;
  for (const h of hits) while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return { line: prefix.length > input.length ? prefix : input, list: hits };
}

/** The commands whose argument is a path, so Tab after them completes files rather than commands. */
const PATH_COMMANDS = new Set(["cd", "cat", "ls"]);

/**
 * Tab on the whole line: the first word completes against commands; the word after `cd`, `cat` or
 * `ls` completes against the file system (`paths` lists the matches for a partial path). A folder
 * keeps the word open (`ops/`), a file closes it with a space.
 */
export function completeLine(input: string, known: readonly string[], paths: (partial: string) => string[]): { line: string; list: string[] } {
  const m = /^(\S+)(\s+)(.*)$/.exec(input);
  if (!m) return complete(input, known);
  if (!PATH_COMMANDS.has(m[1]!)) return { line: input, list: [] };
  const hits = paths(m[3]!);
  const head = `${m[1]}${m[2]}`;
  if (hits.length === 0) return { line: input, list: [] };
  if (hits.length === 1) return { line: head + hits[0] + (hits[0]!.endsWith("/") ? "" : " "), list: [] };
  let prefix = hits[0]!;
  for (const h of hits) while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return { line: head + (prefix.length > m[3]!.length ? prefix : m[3]), list: hits.map((h) => h.split("/").filter(Boolean).at(-1)! + (h.endsWith("/") ? "/" : "")) };
}

/** Kali sets `hist_ignore_dups` and `hist_ignore_space`; blanks are not history either. */
export function remember(history: readonly string[], line: string, max = 100): string[] {
  if (!line.trim() || line.startsWith(" ") || history.at(-1) === line) return [...history];
  return [...history, line].slice(-max);
}

/** Whatever is in storage, a list of strings comes out: a corrupt entry is history lost, not a crash. */
export function loadHistory(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** ↑/↓ over a snapshot of history. ↓ past the newest line gives back what was being typed. */
export class Recall {
  private readonly lines: readonly string[];
  private at: number;
  private draft = "";
  constructor(history: readonly string[]) {
    this.lines = history;
    this.at = history.length;
  }
  up(draft: string): string {
    if (this.lines.length === 0) return draft;
    if (this.at === this.lines.length) this.draft = draft;
    this.at = Math.max(0, this.at - 1);
    return this.lines[this.at]!;
  }
  down(): string {
    this.at = Math.min(this.lines.length, this.at + 1);
    return this.at === this.lines.length ? this.draft : this.lines[this.at]!;
  }
}
