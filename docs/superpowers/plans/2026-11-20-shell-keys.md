# Shell Keyboard Basics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab completion, history, Ctrl+L, Esc/Ctrl+U and Kali's `127 ×` RPROMPT on the site shell.

**Architecture:** Pure logic in a new `src/client/readline.ts` (completion, history) and in
`src/client/commands.ts` (exit status, zsh wording), unit-tested from `test/`. `src/client/shell.ts`
wires keys, `sessionStorage` and the RPROMPT span; `src/css.ts` right-aligns it.

**Tech Stack:** TypeScript, `node --test`, esbuild client bundle, DOM.

**Spec:** `docs/superpowers/specs/2026-11-20-shell-keys-design.md`

## Global Constraints

- Client code stays DOM-only (`tsconfig.client.json`); `readline.ts` must not import Node.
- History: `sessionStorage` key `lazie:history`, max 100. Status codes: not found 127, sudo 1, else 0.
- Wording: `zsh: command not found: <word>`. RPROMPT glyph `×` (U+00D7).

## Review Focus

- Tab with focus: must never move focus out of `#io` (rushi's bug) — headless key test, Task 2.
- `sessionStorage` unavailable/throwing (privacy mode) → shell still works, history in memory only (Task 2: wrap in try).
- Corrupt/non-array JSON in `lazie:history` → ignored, not a crash (Task 1 `loadHistory` test).
- Long typed line reaching the RPROMPT → RPROMPT hidden (Task 2).
- Tab during `[nyae]` → ignored (Task 2).

---

### Task 1: Pure logic — completion, history, status, wording

**Files:** Create `src/client/readline.ts`, `test/readline.test.ts`; modify `src/client/commands.ts`, `src/client/shell.ts` (wording only); create `test/commands.test.ts`.

**Interfaces — produces:**
- `complete(input: string, known: readonly string[]): { line: string; list: string[] }` — `list` empty unless ambiguous or input empty (then all, sorted).
- `remember(history: readonly string[], line: string, max?: number): string[]` (default 100).
- `loadHistory(raw: string | null): string[]` — tolerant parse.
- `class Recall { constructor(history: readonly string[]); up(draft: string): string; down(): string }`.
- `Outcome` rows variant gains `status: number`.

- [ ] **Step 1: Failing tests:** `complete("fi", known)` → `{line:"findings ", list:[]}`; ambiguous `"c"` with clear/contact → `line:"c"`, list both; shared prefix extends (`"he"` with help/hello → `"hel"`); no match → unchanged, empty list; `""` → all sorted; input with a space → unchanged. `remember`: skips consecutive dup, skips leading-space, skips empty, caps at max dropping oldest. `loadHistory`: null / `"x"` / `"{}"` / `[1,"a"]` → `[]` / `[]` / `[]` / `["a"]`. `Recall`: up/up/down/down returns newest, older, newer, draft; up at oldest stays. `run("nope")` status 127 and text `zsh: command not found: nope`; `run("sudo x")` status 1; `run("whoami")` status 0.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement; change both `bash:` messages.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → PASS/clean.
- [ ] **Step 5:** commit `feat(shell): completion, history and exit status, in zsh's words`.

### Task 2: Wire the keys and the RPROMPT

**Files:** modify `src/client/shell.ts`, `src/css.ts`.

**Interfaces — consumes:** Task 1 exports; `Outcome.status`.

- [ ] **Step 1:** Wire Tab / ↑ / ↓ / Ctrl+L / Esc / Ctrl+U in the `#io` keydown handler (ignored while `correcting`); history load/save via `sessionStorage` in try/catch; RPROMPT `<span class="rprompt">` in the cmdline row, set from the last status, hidden on overlap.
- [ ] **Step 2:** `npm test`, `npm run typecheck`, `npm run build` → PASS/clean.
- [ ] **Step 3: Headless key test** over CDP (`Input.dispatchKeyEvent`): `fi`+Tab → `findings `; `c`+Tab lists; `nope`+Enter → `127 ×` visible; ↑ recalls `nope`; Esc clears; Ctrl+L empties log; `document.activeElement.id === "io"` after every Tab; screenshot.
- [ ] **Step 4:** commit `feat(shell): Tab, history, Ctrl+L, Esc and Kali's 127 × prompt`.
