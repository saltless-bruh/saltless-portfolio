# lazie.dev

The Handle's own site, and the Profile README's primary outbound link. It is not a page with a
terminal on it: the site IS a terminal, and the shell is the router.

Identity and borrowed-grammar policy live in the profile repo (`saltless-bruh/saltless-bruh`,
ADR 0001 and ADR 0002). Terms defined in its `CONTEXT.md` are not restated here, and the decisions
in those records are not re-litigated here.

## Language

### Surfaces

**Shell**:
The REPL at `/`, and the router: what a visitor types there becomes a Screen.
_Avoid_: console, command line, home page, landing page

**Screen**:
One route, prerendered as its own HTML file at its own URL, focused on a single subject.
_Avoid_: page, section, view, tab

**Window Bar**:
The tmux-style bar carrying every Screen as a numbered window, present on all of them. It is the
whole of the navigation, which is why it is named for what it does and not for tmux's status line.
_Avoid_: status bar, navbar, tab bar, footer, menu

**MOTD**:
The masthead that prints on arrival, carrying the Wordmark, the Panel and the boot lines. Nothing
invokes it.
_Avoid_: hero, header, splash, title card

**Boot**:
The short auto-run sequence between the MOTD and the live prompt. It exists so that a visitor who
never thinks to type still reaches content; the REPL is a reward, never a gate.
_Avoid_: intro, loading screen, animation, splash

**Shell Prompt**:
The two rows that open the Shell, borrowed from Kali: `┌─(chill@root)-[~/saltless-bruh]` above
`└─$`. It is the site's one-look claim to offensive security, and `root` sits in the host slot
deliberately, where a real prompt puts it first: the single seam that admits the terminal is built.
_Avoid_: prompt line, caret, input line, cursor

**Panel**:
The persona readout printed under the Wordmark as part of the MOTD, in the shape `fastfetch` prints
with its logo on top: `user: chill`, `host: root`, `uptime: horizontal`, and two Telemetry lines.
Every value is a state or a joke and none is a machine fact, because real output would publish a
second identifier and hand out reconnaissance on the operator's own box.
_Avoid_: fastfetch panel, system info, sysinfo, stats

### Typing

**Command**:
A word a visitor types at the Shell, which either opens a Screen or prints one line in place. The
profile repo's glossary uses this word for a slash-command invocation inside its Session; it does
not mean that here.
_Avoid_: slash command, link, nav item, route

**Agent**:
`napping`, the agent CLI reached at `/napping`: a nested REPL with its own version and commands,
where the Handle's AI work is shown, borrowing an agent CLI's grammar and none of its marks. Its
name is the Command rather than a separate choice, because `napping &` is already shell for "run
the program `napping` in the background".
_Avoid_: chatbot, assistant, terminal, Claude Code, fake agent

**Deflection**:
What the Agent answers when input is not one of its commands. It stays in character rather than
erroring the way a shell does, which is what keeps the two REPLs sounding like two programs.
_Avoid_: fallback, error, 404, easter egg

**Miss**:
An unrecognised Command, recorded as the only thing the site collects about a visitor, so that what
people reach for can decide what gets built next.
_Avoid_: error, 404, analytics, event

### Content

**Finding**:
A flaw discovered in a target, published as a writeup or a CVE. Never a fault on the operator's own
machine: that is the profile repo's Alarm.
_Avoid_: vulnerability, bug, report, loot, issue

**Alarm**:
The rack fault that wakes the Mascot, played here when the first Finding lands rather than on
arrival, so that an empty table means something instead of apologising for itself.
_Avoid_: alert, notification, finding, incident

**Telemetry**:
Coarse, derived measurements the operator's own machine pushes out on a fixed cadence. Never a value
that identifies the machine, and never an instantaneous one.
_Avoid_: stats, metrics, monitoring, analytics, live data
