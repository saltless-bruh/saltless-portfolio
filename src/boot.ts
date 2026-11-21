/**
 * The shell's boot: the MOTD ticks in under the wordmark, `help` types itself and answers, and the
 * prompt goes live. Every line is already in the document; the boot only reveals it.
 *
 * The budget is the owner's, from October: first paint ≤ 400 ms (the wordmark, which never hides),
 * prompt live ≤ 1.5 s. It is enforced by a test, because "short" is the word that became 8.5 s
 * on the profile.
 *
 * Mechanism: an element is hidden only BY its own animation (`backwards` fill during the delay), so
 * a browser that runs no animation shows everything, and `finish()` skips to the end state. It is
 * hidden with OPACITY, not visibility: visibility takes nodes out of the accessibility tree, and
 * their return inside the log's live region would be announced letter by letter (found in review).
 */
export const BUDGET_MS = 1500;
/** How long past the prompt the hint waits for the client to reveal it (with its scramble). */
export const HINT_HOLD = 400;

/** One MOTD line every 50 ms; `help` typed at 30 ms a letter; one help row every 35 ms. */
const STEP = { first: 60, motd: 50, beforeEcho: 90, letter: 30, enter: 110, row: 35, beforePrompt: 90 } as const;

export type BootSchedule = { motd: number[]; echo: number; typed: number[]; help: number[]; prompt: number };

export function bootSchedule(n: { motd: number; typed: number; help: number }): BootSchedule {
  const motd = Array.from({ length: n.motd }, (_, i) => STEP.first + i * STEP.motd);
  const echo = (motd.at(-1) ?? 0) + STEP.beforeEcho;
  const typed = Array.from({ length: n.typed }, (_, i) => echo + (i + 1) * STEP.letter);
  const helpAt = (typed.at(-1) ?? echo) + STEP.enter;
  const help = Array.from({ length: n.help }, (_, i) => helpAt + i * STEP.row);
  const prompt = (help.at(-1) ?? helpAt) + STEP.beforePrompt;
  return { motd, echo, typed, help, prompt };
}

/** Class names for each revealed thing: `bm-i` MOTD lines, `be` the echoed prompt, `bt-i` letters, `bh-i` help rows, `bp` the live prompt. */
export function bootCss(s: BootSchedule): string {
  const rule = (cls: string, at: number) => `.booting .${cls} { animation: boot-in 1ms step-end backwards; animation-delay: ${at}ms }`;
  return [
    "@keyframes boot-in { from { opacity: 0 } to { opacity: 0 } }",
    ...s.motd.map((at, i) => rule(`bm-${i}`, at)),
    rule("be", s.echo),
    ...s.typed.map((at, i) => rule(`bt-${i}`, at)),
    ...s.help.map((at, i) => rule(`bh-${i}`, at)),
    rule("bp", s.prompt),
    // The hint waits past the prompt: the client reveals it at the boot's end and starts its scramble
    // in the same moment, so its final text never flashes before the noise.
    rule("bk", s.prompt + HINT_HOLD),
  ].join("\n");
}

/** Set on <html> before first paint, only for a tab that has not booted and does not ask for less motion. */
export const BOOT_GATE = `<script>try{if(!sessionStorage.getItem("lazie:booted")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("booting")}catch(e){}</script>`;
