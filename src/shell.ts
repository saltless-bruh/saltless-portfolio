import type { Content } from "./content.ts";
import type { Row } from "./rows.ts";
import { motdRows } from "./motd.ts";

/** Kali's marks. `㉿`, the circled KA in Kali's own prompt, is absent from JetBrains Mono. */
export const PROMPT_OPEN = "┌─(";
export const PROMPT_AT = "@";
export const PROMPT_PATH_OPEN = ")-[";
export const PROMPT_PATH_CLOSE = "]";
export const PROMPT_SIGIL = "└─$";

/**
 * The two rows that open the Shell.
 *
 * `root` sits in the HOST slot, where a real prompt would put it first. That is deliberate and it
 * is the only seam in the reconstruction: the frame, the path, the sigil and the colour roles are
 * all exactly right, so one inversion reads as intent rather than as a misunderstanding. It also
 * makes `$` correct rather than a compromise, because the user `chill` is unprivileged on a host
 * that merely happens to be called root.
 */
export function promptRows(c: Content): Row[] {
  const head = [
    { col: 0, text: PROMPT_OPEN, style: "muted" as const },
  ];
  let col = PROMPT_OPEN.length;
  const push = (text: string, style: "muted" | "accent" | "text", cls?: string) => {
    head.push({ col, text, style, cls } as never);
    col += [...text].length;
  };
  push(c.prompt.user, "accent");
  push(PROMPT_AT, "muted");
  push(c.prompt.host, "text");
  push(PROMPT_PATH_OPEN, "muted");
  // Classed so the client can follow `cd`: the path changes length, and the bracket after it moves.
  push(`~/${c.login}`, "text", "cwd");
  push(PROMPT_PATH_CLOSE, "muted", "cwd-end");
  return [
    { runs: head },
    { cls: "cmdline", runs: [{ col: 0, text: PROMPT_SIGIL, style: "muted" }] },
  ];
}

/** The column the typed command starts at: after the sigil and the space following it. Derived. */
export const INPUT_COL = [...PROMPT_SIGIL].length + 1;

export function shellRows(c: Content): Row[] {
  return [
    ...motdRows(c),
    { runs: [] },
    ...promptRows(c),
    { runs: [] },
    { cls: "hint", runs: [{ col: 0, text: c.hint, style: "muted" }] },
  ];
}
