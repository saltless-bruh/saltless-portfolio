# `ops/` Offense Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browsable `ops/` tree in the shell, with `cat file.md` opening a rendered reader page.

**Architecture:** `src/client/fs.ts` (pure: tree type, path resolution, ls/cd/cat outcomes, path
completion) runs in the browser on a tree the build embeds in the shell cfg. `src/ops.ts` (Node,
build) reads the repo `ops/` folder into that tree. `src/reader.ts` (build) renders each file with
`marked` into a themed HTML page at `/ops/<path>`. `findings` page removed.

**Tech Stack:** TypeScript, `node --test`, esbuild, `marked` 18 (devDependency, build only).

**Spec:** `docs/superpowers/specs/2026-11-20-ops-offense-area-design.md`

## Global Constraints

- No Markdown library in the browser bundle. Reader glyphs the font lacks fall back to the system
  mono stack instead of failing the build (writeups are the owner's text, not the UI's).
- BlogCMS page must not contain `/api/`, `.php`, `localhost`, `http`, or the names from the lab's source (checked by hash).
- zsh error wording; status 1 for fs errors.

## Review Focus

- Path traversal: `cd ../../..` or `cat ../../etc/passwd` → stays inside `~` (Task 1 test).
- A file name with spaces or capitals → still resolvable and linkable (Task 1/2 tests).
- An `ops/` file that is not `.md` → ignored by the tree (Task 2 test).
- Wikilink to a missing file → plain text, not a broken link (Task 2 test).
- sessionStorage cwd pointing at a removed directory → falls back to `~` (Task 3).

---

### Task 1: The file system, pure
Files: `src/client/fs.ts`, `test/fs.test.ts`.
Produces: `type Node = { dir: true; kids: Record<string, Node> } | { dir: false; href: string }`;
`resolve(tree, cwd: string[], path: string): string[] | null`; `ls(tree, cwd, arg?)`, `cd(...)`,
`cat(...)` → `{ rows/lines, status, cwd?, go? }`; `completePath(tree, cwd, partial): string[]`;
`displayPath(cwd): string`.
- [ ] Failing tests → implement → `npm test`, typecheck → commit.

### Task 2: The tree and the reader, at build
Files: `src/ops.ts`, `src/reader.ts`, `ops/**`, `src/build.ts`, `src/css.ts`, `test/reader.test.ts`, `package.json`.
- [ ] Failing tests (tree from a temp folder; callout; wikilink; code label; image; BlogCMS leak
  check; non-md ignored) → implement → build → commit.

### Task 3: Wire the shell; remove `findings`
Files: `src/client/commands.ts`, `src/client/shell.ts`, `src/html.ts`, `src/screens.ts`, `src/build.ts`, `src/content.ts`, `content.json`, tests.
- [ ] Failing tests for `run()` with fs commands and `help`/screens without findings → implement →
  build → headless key run → commit.
