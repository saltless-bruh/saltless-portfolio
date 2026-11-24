import { renderRowsHtml } from "../rows.ts";
import type { Row } from "../rows.ts";
import { run, BUILTINS, type Cfg, type Outcome } from "./commands.ts";
import { completeLine, remember, loadHistory, Recall } from "./readline.ts";
import { resolve, completePath, validCwd, fitPath } from "./fs.ts";
import { scramble } from "./scramble.ts";
import { wireAlarm } from "./alarm.ts";
import { bootRoom } from "./room.ts";
import { NARROW } from "../room.ts";

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

const cfg: Cfg & { active: string | null; bootEnd?: number; napping?: import("./agent.ts").AgentCfg } = JSON.parse($("#cfg").textContent ?? "{}");

/**
 * The room's controls, once it is up: `exit` uses them to go back out. Declared before anything runs:
 * `bootShell` is called further down the module and assigns this, and a declaration placed after that
 * call (the bundler turns top-level `let` into `var`) would reset it to null once the call returned.
 */
let roomCtl: { zoomOut: () => void } | null = null;

// The cat's rack goes haywire now and then. Not under reduced motion: the CSS holds a still frame.
const mascot = document.querySelector<SVGSVGElement>("svg.mascot");
if (mascot && !matchMedia("(prefers-reduced-motion: reduce)").matches) wireAlarm(mascot);

const io = document.querySelector<HTMLInputElement>("#io");
if (cfg.active === "napping" && io && cfg.napping) {
  // Dynamic, so anime.js ships with the one screen that animates. The shell is the most-visited
  // page and the one with the tightest budget; it has no reason to download a motion library.
  const napping = cfg.napping;
  void import("./agent.ts").then((m) => m.bootAgent(napping, io));
} else if (!io) {
  // A focused screen: no prompt to own the keyboard, so the way out is a keystroke.
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "q" || e.key === "Escape") { e.preventDefault(); window.location.assign("/"); }
  });
} else {
  bootShell(io);
}

function bootShell(io: HTMLInputElement): void {
// `exit` can only go back to a room that is there to go back to.
cfg.room = !!document.getElementById("room") && !matchMedia(NARROW).matches;
const term = $<HTMLElement>("#term");
const log = $<HTMLElement>("#log");
const cmdline = $<HTMLElement>("#prompt .cmdline");
const promptHead = $<HTMLElement>("#prompt .row");

/** A pending zsh-style correction, which owns the next keystroke while it is open. */
let correcting: { from: string; to: string } | null = null;

const caret = (text: string): string => {
  const head = text.slice(0, text.length);
  return `<span class="text" style="--c:${cfg.inputCol}">${escape(head)}</span>`
    + `<span class="caret" style="--c:${cfg.inputCol + [...head].length}"> </span>`;
};

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SIGIL = cmdline.innerHTML;
const known = [...cfg.screens.map((s) => s.cmd), ...BUILTINS];

/**
 * History lives in sessionStorage: this tab only, gone when it closes, never sent anywhere. It has
 * to outlive a page load because a screen command navigates. Storage can throw (privacy modes, a
 * full quota), and then history simply stays in memory for the page.
 */
const HISTORY_KEY = "lazie:history";
let history: string[] = (() => { try { return loadHistory(sessionStorage.getItem(HISTORY_KEY)); } catch { return []; } })();
let recall = new Recall(history);
function record(line: string): void {
  history = remember(history, line);
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* memory only */ }
  recall = new Recall(history);
}

/**
 * The working directory inside ops/'s tree, kept for the tab like history, so `q` back from the
 * reader lands where `cat` was typed. A stored path that no longer exists falls back to home.
 */
const CWD_KEY = "lazie:cwd";
let cwd: string[] = (() => {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(CWD_KEY) ?? "[]");
    const at = Array.isArray(raw) && raw.every((p) => typeof p === "string") ? raw : [];
    return validCwd(cfg.fs, resolve(cfg.fs, [], at.join("/") || ".") ?? []);
  } catch { return []; }
})();
/** The prompt's path follows `cd`; the closing bracket moves with it, since every run is placed by column. */
function showCwd(): void {
  const path = document.querySelector<HTMLElement>("#prompt .cwd");
  const end = document.querySelector<HTMLElement>("#prompt .cwd-end");
  if (!path || !end) return;
  // Shortened to the row: the prompt head before the path, the path, then one column for `]`.
  const cell = document.querySelector<HTMLElement>("#prompt .caret")?.getBoundingClientRect().width || 0;
  const cols = cell ? Math.floor(path.parentElement!.getBoundingClientRect().width / cell) : 40;
  const text = fitPath(cfg.home, cwd, Math.max(8, cols - Number(path.style.getPropertyValue("--c")) - 1));
  path.textContent = text;
  end.style.setProperty("--c", String(Number(path.style.getPropertyValue("--c")) + [...text].length));
}
function chdir(to: string[]): void {
  cwd = to;
  try { sessionStorage.setItem(CWD_KEY, JSON.stringify(cwd)); } catch { /* memory only */ }
  showCwd();
}
showCwd();

/** The last command's exit status, shown as Kali's right prompt (`%? ⨯`, with `×` for the glyph JetBrains Mono lacks). */
let status = 0;
const rprompt = (): string => (status === 0 ? "" : `${status} ×`);

function paint(): void {
  const r = rprompt();
  // Hidden while the typed line would reach it, as zsh does. One caret cell is the column width.
  const cell = cmdline.querySelector<HTMLElement>(".caret")?.getBoundingClientRect().width || 0;
  const cols = cell ? Math.floor(cmdline.getBoundingClientRect().width / cell) : Infinity;
  const fits = cfg.inputCol + [...io.value].length + 2 + r.length <= cols;
  const right = r && fits ? `<span class="rprompt"><span class="muted">${status}</span> <span class="error">×</span></span>` : "";
  cmdline.innerHTML = SIGIL + right + caret(io.value);
}

/** The executed line and its output become history; the live prompt stays at the bottom. */
function commit(rows: Row[]): void {
  const echoed = `<div class="row">${promptHead.innerHTML}</div>`
    + `<div class="row">${SIGIL}<span class="text" style="--c:${cfg.inputCol}">${escape(io.value)}</span></div>`;
  log.insertAdjacentHTML("beforeend", echoed + (rows.length ? renderRowsHtml(rows) : "") + `<div class="row"></div>`);
}

function apply(out: Outcome): void {
  if (out.kind === "clear") { status = 0; log.innerHTML = ""; io.value = ""; paint(); return; }
  if (out.kind === "go") { commit([]); window.location.assign(out.to); return; }
  if (out.kind === "nothing") { commit([]); io.value = ""; paint(); return; }
  if (out.kind === "room") { commit([]); io.value = ""; paint(); io.blur(); roomCtl?.zoomOut(); return; }
  if (out.kind === "correct") {
    commit([{ runs: [{ col: 0, text: `correct '${out.from}' to '${out.to}' [nyae]? `, style: "warning" }] }]);
    correcting = { from: out.from, to: out.to };
    io.value = "";
    paint();
    return;
  }
  status = out.status;
  commit(out.rows);
  if (out.cwd) chdir(out.cwd);
  io.value = "";
  paint();
}

function answerCorrection(key: string): void {
  const c = correcting!;
  correcting = null;
  if (key === "y") { io.value = c.to; apply(run(c.to, cfg, cwd)); return; }
  if (key === "e") { io.value = c.from; paint(); return; }
  if (key === "a") { io.value = ""; paint(); return; }
  io.value = c.from;
  apply({
    kind: "rows",
    status: 127,
    rows: [
      { runs: [{ col: 0, text: `zsh: command not found: ${c.from}`, style: "error" }] },
      { runs: [{ col: 0, text: cfg.notFound, style: "muted" }] },
    ],
  });
}

io.addEventListener("input", paint);
/** Tab's listing: the line as typed, then the matches in columns, then the prompt again. */
function listMatches(list: string[]): void {
  const pad = Math.max(...list.map((w) => w.length)) + 2;
  const rows: Row[] = [];
  for (let i = 0; i < list.length; i += 3) {
    rows.push({ runs: list.slice(i, i + 3).map((w, j) => ({ col: j * pad, text: w, style: "accent" as const })) });
  }
  commit(rows);
}

io.addEventListener("keydown", (e) => {
  // Tab never leaves the prompt, whatever state it is in: losing focus to the page is the bug.
  if (e.key === "Tab") e.preventDefault();
  if (correcting) {
    const k = e.key.toLowerCase();
    if (["y", "n", "a", "e"].includes(k)) { e.preventDefault(); answerCorrection(k); }
    return;
  }
  const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
  if (e.key === "Enter") { e.preventDefault(); record(io.value); apply(run(io.value, cfg, cwd)); return; }
  if (e.key === "Tab") {
    const { line, list } = completeLine(io.value, known, (p) => completePath(cfg.fs, cwd, p));
    if (list.length) listMatches(list);
    io.value = line;
    paint();
    return;
  }
  if (e.key === "ArrowUp") { e.preventDefault(); io.value = recall.up(io.value); paint(); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); io.value = recall.down(); paint(); return; }
  if (ctrl && e.key.toLowerCase() === "l") { e.preventDefault(); log.innerHTML = ""; paint(); return; }
  if (e.key === "Escape" || (ctrl && e.key.toLowerCase() === "u")) { e.preventDefault(); io.value = ""; paint(); }
});

const focus = () => { io.focus({ preventScroll: true }); term.dataset.focus = "on"; };
io.addEventListener("blur", () => { term.dataset.focus = "off"; });
io.addEventListener("focus", () => { term.dataset.focus = "on"; });
document.addEventListener("pointerdown", (e) => {
  // Let a real selection or a link win; anything else means the visitor wants the prompt. The room
  // is not the prompt: while it covers the window, a click there is the room's.
  if ((e.target as Element)?.closest("a, #room") || document.documentElement.classList.contains("room")) return;
  if (!window.getSelection()?.toString()) focus();
});

paint();
showCwd();
// While the room covers the window the shell waits behind it, unfocused, until the monitor is clicked.
if (!document.documentElement.classList.contains("room")) focus();

/**
 * The one scripted moment on this screen, and it marks a state change rather than decorating one:
 * the hint resolving is the machine finishing its boot and handing the prompt over. It runs after
 * first paint, so it cannot cost the budget, and `scramble` returns the end state at once under
 * `prefers-reduced-motion`.
 *
 * PROVISIONAL placement. The effect's real home is a Telemetry value arriving from the Worker,
 * where noise resolving into a number is what actually happened. This moves into the boot timeline
 * when that exists.
 */
const hint = document.querySelector("#hint span");
let hinted = false;
const startHint = () => { if (hint && !hinted) { hinted = true; void scramble(hint, cfg.hint, { duration: 520 }); } };

/**
 * The boot. `<html class="booting">` was set before first paint by the inline gate (a tab that has
 * not booted, without reduced motion); the CSS schedule does the revealing. This only marks the tab
 * as booted, lets any key or click skip to the end, and makes sure the end state is reached: on
 * time, and again by a 2.5 s safety timer, because a boot must never leave content hidden. The key
 * that skips is not swallowed: a letter typed during the boot lands in the prompt.
 */
const root = document.documentElement;
const runBoot = (): void => {
if (root.classList.contains("booting")) {
  try { sessionStorage.setItem("lazie:booted", "1"); } catch { /* boots again next time */ }
  const end = () => {
    if (!root.classList.contains("booting")) return;
    for (const a of document.getAnimations()) if ((a as CSSAnimation).animationName === "boot-in") a.finish();
    root.classList.remove("booting");
    document.removeEventListener("keydown", end, true);
    document.removeEventListener("pointerdown", end, true);
    startHint();
  };
  document.addEventListener("keydown", end, true);
  document.addEventListener("pointerdown", end, true);
  setTimeout(end, cfg.bootEnd ?? 0);
  setTimeout(end, 2500);
} else {
  startHint();
}
};

/**
 * The room (/ only). Entering it is where the shell's boot begins: the gate held `booting` back
 * while the room was up, so it is added here, and the CSS schedule plays as the zoom lands.
 */
roomCtl = document.getElementById("room") ? bootRoom({
  onEnter: () => {
    let booted = false;
    try { booted = !!sessionStorage.getItem("lazie:booted"); } catch { /* boot */ }
    if (!booted && !matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("booting");
    runBoot();
    focus();
  },
}) : null;
if (!root.classList.contains("room")) runBoot();
}
