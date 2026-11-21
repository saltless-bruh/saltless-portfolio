import type { Content } from "./content.ts";
import type { Row } from "./rows.ts";

/**
 * tmux's window list, used as the whole of the navigation.
 *
 * It earns its row on the one risk the audience research named: the reader who decides is
 * terminal-native but impatient, so the route list has to be on screen from the first frame rather
 * than waiting to be typed or guessed. What keeps it a window bar and not a navigation bar wearing
 * a monospace font: the numbers are real keybindings, the active window is inverse-highlighted, the
 * session name sits left, and status sits right, which is where tmux users already look for it.
 *
 * The scroll-spy half of the original idea is gone. It assumed one scrolling page; routes became
 * separate screens, so the active window IS the current route and there is nothing to track.
 */
export function windowBarRows(c: Content, active: string | null): Row[] {
  const runs: Row["runs"] = [];
  let col = 0;
  const push = (text: string, style: Row["runs"][number]["style"], cls?: string) => {
    runs.push({ col, text, style, cls });
    col += [...text].length;
  };
  push(`[${c.handle.toLowerCase()}]`, "accent");
  push(" ", "muted", "sep");
  push(active === null ? "0:shell" : "0:shell", active === null ? "text" : "muted", active === null ? "win on" : "win");
  for (const [i, s] of c.screens.entries()) {
    push(" ", "muted", "sep");
    const on = active === s.cmd;
    push(`${i + 1}:${s.cmd}`, on ? "text" : "muted", on ? "win on" : "win");
  }
  return [{ cls: "bar", runs }];
}
