# Shell keyboard basics — design (approved 2026-11-20)

## Intent

The reference sites (satnaing/terminal-portfolio, webshellx, noel-friedrich.de/terminal,
rushi-bashfolio) show visitors expect a shell's keyboard habits. The site's prompt is Kali's zsh
twoline prompt, so behaviour follows zsh / Kali's `.zshrc` (kali-defaults, verified 2026-11-20).

## Approaches (failure indicator)

| | Look | Verdict |
|---|---|---|
| **A** | Kali's RPROMPT: `<code> ×` right-aligned on the `└─$` line | **Chosen.** Kali's own design (`%(?.. %? %F{red}%B⨯…)`, commented out in current defaults); `⨯` is absent from JetBrains Mono, `×` (U+00D7) is present. |
| B | red `$` | In Kali red marks root's `#`; a red `$` says "root". |
| C | nothing | The error text already says it. |

## Design

- **Tab** completes the first word against screen commands + builtins. One match → word + space.
  Several → extend to the common prefix and list matches below (echoed prompt + partial line, then
  the list), prompt redrawn. Empty line → list all (deliberate deviation: zsh inserts a tab).
  Always `preventDefault`: focus never leaves the prompt.
- **↑/↓** history: ↓ past newest restores the draft. `hist_ignore_dups` (no consecutive repeats),
  `hist_ignore_space` (leading-space lines not stored). `sessionStorage`, key `lazie:history`,
  max 100, tab-scoped, never sent.
- **Ctrl+L** clears the log, keeps the typed line. **Esc / Ctrl+U** clear the line.
- **RPROMPT:** after a non-zero status, the next prompt shows `127 ×` (code `muted`, `×` `error`)
  right-aligned on the cmdline row; hidden when status is 0, and hidden while the typed line would
  reach it. Status: not found 127, `sudo` 1, else 0. A declined correction (`n`) is 127.
- **zsh wording:** `zsh: command not found: <word>` replaces `bash: <word>: command not found`.
- **During `[nyae]`:** Tab and ↑/↓ are ignored.

## Non-goals

Commands, routes, correction flow, `/napping`'s agent prompt; argument completion.

## Verification

Unit tests for completion, history and exit statuses; `npm test`, `npm run typecheck`, `npm run
build`; headless Chrome typing real keys (Tab, ↑, Ctrl+L, Esc, a failed command → `127 ×`).
