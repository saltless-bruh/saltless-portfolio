/**
 * Text scramble: a value resolves out of noise, left to right.
 *
 * Two rules the cell grid imposes, and both are the reason a naive version looks broken here.
 * The noise is always the SAME LENGTH as the final string, so a row can never change width while
 * it animates and the columns beside it cannot jitter. And the charset is ASCII only, because the
 * grid is one glyph per cell and a character JetBrains Mono does not carry would render as a box
 * of a different width.
 */
const CHARS = "!<>-_\\/[]{}=+*^?#01";

export type ScrambleOptions = {
  /** Total time in ms. Each position settles at `i / length` of the way through. */
  duration?: number;
  /** Frame interval in ms. The grid is text, so 60fps buys nothing a 20Hz flicker does not. */
  tick?: number;
};

const reduced = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const pick = (): string => CHARS[Math.floor(Math.random() * CHARS.length)]!;

/**
 * Resolves `el` to `final`. Returns a promise so a caller can sequence it. Under
 * `prefers-reduced-motion` the text is set at once: the end state, not a faster animation.
 */
export function scramble(el: Element, final: string, opts: ScrambleOptions = {}): Promise<void> {
  const chars = [...final];
  if (reduced() || !chars.length) {
    el.textContent = final;
    return Promise.resolve();
  }
  const duration = opts.duration ?? 420;
  const tick = opts.tick ?? 50;
  const start = performance.now();
  return new Promise<void>((resolve) => {
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // A position is settled once the wave front has passed it; before that it is noise, and a
      // space stays a space so word boundaries do not flicker.
      const front = t * chars.length;
      el.textContent = chars
        .map((ch, i) => (i < front || ch === " " ? ch : pick()))
        .join("");
      if (t >= 1) {
        el.textContent = final;
        resolve();
        return;
      }
      setTimeout(() => step(performance.now()), tick);
    };
    step(performance.now());
  });
}
