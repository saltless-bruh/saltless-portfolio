/**
 * The shell's file system: the offense work as files. The tree is built from the repo's `ops/`
 * folder at build time and embedded in the page; this module only walks it. Pure, so it is tested
 * in Node and runs in the browser.
 *
 * Home (`~`) is the top. There is no `/`: `..` stops at home rather than leaving the site's own
 * story, and an absolute path finds nothing, which is also what a visitor poking for `/etc/passwd`
 * deserves.
 */
export type Node = { dir: true; kids: Record<string, Node> } | { dir: false; href: string };

/** Words from a path, `~` resolved against home and `.`/`..` against the working directory. */
export function resolve(tree: Node, cwd: string[], path: string): string[] | null {
  if (path.startsWith("/")) return null;
  let at: string[] = path === "~" || path.startsWith("~/") ? [] : [...cwd];
  const parts = (path.startsWith("~") ? path.slice(1) : path).split("/").filter((p) => p && p !== ".");
  for (const p of parts) {
    if (p === "..") { at = at.slice(0, -1); continue; }
    at.push(p);
    if (!nodeAt(tree, at)) return null;
  }
  return nodeAt(tree, at) ? at : null;
}

function nodeAt(tree: Node, at: string[]): Node | null {
  let n: Node = tree;
  for (const p of at) {
    if (!n.dir) return null;
    const next: Node | undefined = n.kids[p];
    if (!next) return null;
    n = next;
  }
  return n;
}

/** Folders first and marked with `/`, then files, each group alphabetical. */
function entries(n: Node & { dir: true }): string[] {
  const names = Object.keys(n.kids).sort();
  return [...names.filter((k) => n.kids[k]!.dir).map((k) => `${k}/`), ...names.filter((k) => !n.kids[k]!.dir)];
}

export type LsResult = { entries: string[]; note?: string; error?: string; status: number };

/** GNU `ls`, as Kali ships it: exit status 2 when a path is missing. */
export function ls(tree: Node, cwd: string[], arg: string | undefined, emptyNote: string): LsResult {
  const at = resolve(tree, cwd, arg ?? ".");
  if (!at) return { entries: [], error: `ls: cannot access '${arg}': No such file or directory`, status: 2 };
  const n = nodeAt(tree, at)!;
  if (!n.dir) return { entries: [arg!], status: 0 };
  const list = entries(n);
  return list.length ? { entries: list, status: 0 } : { entries: [], note: emptyNote, status: 0 };
}

export function cd(tree: Node, cwd: string[], arg: string | undefined): { cwd?: string[]; error?: string; status: number } {
  if (arg === undefined) return { cwd: [], status: 0 };
  const at = resolve(tree, cwd, arg);
  if (!at) return { error: `cd: no such file or directory: ${arg}`, status: 1 };
  if (!nodeAt(tree, at)!.dir) return { error: `cd: not a directory: ${arg}`, status: 1 };
  return { cwd: at, status: 0 };
}

/** `cat` opens the rendered reader: one command for reading a file (the owner's call). */
export function cat(tree: Node, cwd: string[], arg: string | undefined): { go?: string; error?: string; status: number } {
  if (arg === undefined) return { error: "cat: missing file operand", status: 1 };
  const at = resolve(tree, cwd, arg);
  if (!at) return { error: `cat: ${arg}: No such file or directory`, status: 1 };
  const n = nodeAt(tree, at)!;
  if (n.dir) return { error: `cat: ${arg}: Is a directory`, status: 1 };
  return { go: n.href, status: 0 };
}

/** Tab on a path: every entry in the named folder that starts with what was typed. */
export function completePath(tree: Node, cwd: string[], partial: string): string[] {
  const slash = partial.lastIndexOf("/");
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const base = slash >= 0 ? partial.slice(slash + 1) : partial;
  const at = resolve(tree, cwd, dirPart || ".");
  const n = at ? nodeAt(tree, at) : null;
  if (!n || !n.dir) return [];
  return entries(n).filter((e) => e.startsWith(base)).map((e) => dirPart + e);
}

export const displayPath = (cwd: string[]): string => (cwd.length ? `~/${cwd.join("/")}` : "~");

/** A working directory restored from storage: kept only if it is still a folder, else home. */
export function validCwd(tree: Node, at: string[]): string[] {
  const n = nodeAt(tree, at);
  return n && n.dir ? at : [];
}

/**
 * The prompt's path, shortened to `max` columns the way a deep zsh prompt is: the start becomes
 * `~/…/` and as many trailing folders as fit are kept, so the one you are in always shows.
 */
export function fitPath(home: string, cwd: string[], max: number): string {
  const full = home + displayPath(cwd).slice(1);
  if ([...full].length <= max) return full;
  let tail = cwd.at(-1) ?? "";
  for (let i = cwd.length - 2; i >= 0; i--) {
    const next = `${cwd[i]}/${tail}`;
    if ([...`~/…/${next}`].length > max) break;
    tail = next;
  }
  return `~/…/${tail}`;
}
