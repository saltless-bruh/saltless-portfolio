/**
 * The rack goes haywire: LEDs red, the cat wakes angry, swats the chassis twice, headbutts it, LEDs
 * back to normal, back to sleep. The profile SVG plays it inside its one loop; the site's CSS keeps
 * it as a one-shot under `.mascot.alarm`, and this is what fires it.
 *
 * Driven by the animations themselves, not by timers: the idle pose track's loop seam is the cue
 * (the cat is asleep on both sides of it, so the switch is invisible), and the alarm pose track's
 * end is the cue to go back. Removing the class restarts the idle tracks from 0, so the count
 * starts over by itself.
 */
export const ALARM_EVERY = 2;

type Target = {
  addEventListener(type: "animationiteration" | "animationend", f: (e: { animationName: string }) => void): void;
  classList: { add(c: string): void; remove(c: string): void };
};

export function wireAlarm(svg: Target, every = ALARM_EVERY): void {
  let loops = 0;
  svg.addEventListener("animationiteration", (e) => {
    if (e.animationName !== "idle-sleep") return;
    if (++loops < every) return;
    loops = 0;
    svg.classList.add("alarm");
  });
  svg.addEventListener("animationend", (e) => {
    if (e.animationName === "alarm-sleep") svg.classList.remove("alarm");
  });
}
