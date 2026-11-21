# `napping` as the agent side — design (approved 2026-11-20)

## Intent

User's takeaway: *"an offense person whose agents do the work while he naps."* The terminal is the
offense side; `napping` is the agent side and shows the agent/LLM projects. `whoami` is scrapped
everywhere; `/whoami`, `/ops`, `/stack` duplicated `/resume` word for word. `napping` points to
GitHub, it does not compete with it.

## Approaches (the "brain" for free-text input)

| | | Verdict |
|---|---|---|
| **A** | Tiny classifier trained at build time, shipped as JSON, runs in the browser; picks a category, replies are fixed lines | **Chosen.** $0, instant, cannot be injected. True to the joke: it only *pretends* to be a model ("vibe-coded"). |
| B | Llama 3.2 1B/3B on Workers AI (free 10k neurons/day) | An LLM on an offense person's site is itself the injection target. |
| C | LLM in the browser (WebLLM) | ~1 GB download. |

## Design

- **Commands:** `/agent-infra [name]`, `/model-infra [name]`, `/status`, `/help` (+ `clear`, `exit`).
  A group lists its project names; `group name` prints the project's one line and its repo URL
  (`github.com/saltless-bruh/<name>`, plain text). Read from `content.json` `resume.lanes`; the
  `offense/` lane is excluded (terminal side) and `orchbiter` is skipped (abandoned).
- **Boot** auto-types `/agent-infra` (was `/whoami`).
- **Shell:** `whoami` removed from the builtins.
- **Free text:** rules first — auth words → "Shame on you."; > 20 words / 120 chars → "too lazy to
  read"; unknown `/command` → "unknown command. try /help, or don't." Else the classifier picks:
  - off-topic → "Nah! Ask Claude/Gemini/Codex/Grok or Google search yourself. I need nap."
  - injection → "LOL! This Agent CLI is vibe code, it doesn't even worked. Also, shame on you."
  - about → "the projects are in /agent-infra and /model-infra. the human is asleep."
  - greeting → "…zzz. oh. hi. type /help."
  Every reply is preceded by a fake call line, a cat verb (`● Dozing…`), chosen deterministically
  from the input: the pretend model "thinking".
- **Classifier:** multinomial naive Bayes over lowercase word unigrams + bigrams, Laplace smoothing,
  trained from `brain/examples.json` (train + held-out sets per label) at build; deterministic.

## Non-goals

`/effort` + Ultrachill (next, own design); clickable links; the shell boot; the one line.

## Verification

Classifier: held-out accuracy ≥ 90%, the four example inputs land on their labels, deterministic.
napping: group/project outputs, offense + orchbiter absent, no `/whoami`/`/ops`/`/stack`, boot is
`/agent-infra`, routing order (auth > long > unknown command > classifier). Shell: `whoami` gone.
`npm test`, `npm run typecheck`, `npm run build`, headless run typing each kind of input.
