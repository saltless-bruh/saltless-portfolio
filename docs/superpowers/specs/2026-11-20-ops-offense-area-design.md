# The terminal's offense area (`ops/`) — design (for approval, 2026-11-20)

## Intent

The terminal is the offense half of *"an offense person whose agents do the work while he naps"*
and must show real work, not Kali styling. Evidence today: a whitebox pentest summary (BlogCMS,
findings OK to publish, no lab links/source), two tools, CPTS in progress. Coming: CTF writeups
(scattered across the owner's machines), HTB / THM / PortSwigger labs.

## Approaches

| | | Verdict |
|---|---|---|
| **A** | A file system in the shell: `ls`, `cd`, `cat` over an `ops/` tree | **Chosen.** The terminal itself is the evidence; a writeup is a file. |
| B | Fill out the `findings` page | A dashboard you visit, not work you find. |
| C | Both | Same data twice — the `whoami` flaw. |

Reader command: **`cat file.md` renders** (owner's call: one tool per result; usability beats
literal terminal behaviour). No `glow`, no raw view.

## Design

- **Tree** from a repo folder `ops/` of `.md` files, read at build:
  `ops/reports/blogcms.md`, `ops/writeups/` (empty), `ops/labs/` (empty),
  `ops/tools/saltpilot.md`, `ops/tools/csrf-shield-ai.md`, `ops/certs.md`.
  Adding a writeup = adding a file. Front-matter-free; the first `# heading` is the title.
- **Shell commands:** `ls [path]`, `cd path` (`..`, `~`, relative), `pwd`, `cat file.md`.
  `ls` lists files only (pages stay on `help`). Empty directory → `(empty. writeups are being
  collected.)` style line per directory. Errors in zsh wording (`cd: no such file or directory: x`,
  `cat: x: No such file or directory`, `cat: ops: Is a directory`), status 1. Tab completes paths.
  The prompt shows the cwd (`[~/saltless-bruh/ops]`); cwd persists in `sessionStorage`.
- **Reader:** every file is prerendered to its own page `/ops/<path-without-.md>` — a focused
  screen (no prompt; `q`/Esc back to `/`), so a writeup can be linked directly and opens with no
  boot. `cat` navigates there. Rendered at build with `marked` (18.x, MIT, devDependency) into HTML
  styled in the terminal theme (mono font, palette tokens): headings, lists, code blocks boxed
  with a language label, tables, links, **images inline**, Obsidian callouts (`> [!type] title`),
  `[[wikilinks]]` resolved to other files in `ops/`. No Markdown library reaches the browser.
- **`findings` page removed** (command, window, route, content `findings`); its content moves into
  `ops/` (`certs.md`, `tools/`). Window bar renumbers.
- **Copy:** `reports/blogcms.md` as approved 2026-11-20 (findings, chains, fixes, tech stack; no
  endpoints, file names, links or source). `tools/*.md`: one line + repo link; both
  `csrf-shield-ai` and `saltpilot` are public (saltpilot checked with `gh api`, 2026-11-20). `certs.md`: CPTS, in progress.

## Non-goals

The shell boot (next), the one line (on hold), writeup content (owner supplies), search/grep.

## Verification

Unit: tree building, path resolution (`..`, `~`, relative, trailing `/`), `ls`/`cd`/`cat`/`pwd`
outcomes and errors, completion of paths, callout and wikilink rendering, the BlogCMS page leaking
none of: `/api/`, `.php`, `localhost`, `http`, or the names from the lab's source (checked by hash). Then `npm test`, typecheck, build, and a
headless run: `cd ops`, `ls`, Tab, `cat reports/blogcms.md`, `q` back.
