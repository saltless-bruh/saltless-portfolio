import { createTimeline } from "animejs";
import { renderRowsHtml } from "../rows.ts";
import { openEffort, move, slideBack, effortRows, confirmReply, type EffortState } from "./effort.ts";
import {
  RESULT, exchangeRows, deflect, deflectionRows, normalize, slashMenu, workingLine, type NappingCfg,
} from "../napping.ts";
import { Recall, remember } from "./readline.ts";
import type { Row } from "../rows.ts";

export type AgentCfg = NappingCfg & { inputCol: number };
type Cfg = AgentCfg;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The agent's REPL. A DIFFERENT PROGRAM from the shell at `/`, and it sounds like one: no bash
 * `command not found`, and no zsh correction, because reusing the shell's apologies here would
 * flatten two voices into one. Unknown input gets the agent's own deflections.
 */
export function bootAgent(cfg: Cfg, io: HTMLInputElement): void {
  const term = document.querySelector<HTMLElement>("#term");
  const log = document.querySelector<HTMLElement>("#log");
  const box = document.querySelector<HTMLElement>("#prompt");
  const cmdline = document.querySelector<HTMLElement>("#prompt .cmdline");
  const menu = document.querySelector<HTMLElement>("#menu");
  const statusLeft = document.querySelector<HTMLElement>("#status-left");
  if (!term || !log || !box || !cmdline || !menu || !statusLeft) return;

  const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toEnd = () => window.scrollTo({ top: document.documentElement.scrollHeight });
  // The input band is pinned to the bottom, so the conversation needs room under it; the band grows
  // with the menu and with /effort's panel, which is why the room is measured rather than fixed.
  const band = document.querySelector<HTMLElement>("#band");
  if (band && "ResizeObserver" in window) {
    new ResizeObserver(() => { term.style.paddingBottom = `${band.offsetHeight}px`; }).observe(band);
  }

  /**
   * The slash menu: what a half-typed `/word` could become, under the input. ↑↓ pick, Tab fills,
   * Enter runs the pick, Esc closes it until the line changes. `?` on an empty line shows the
   * shortcuts in the same place.
   */
  let sel = 0;
  let dismissed = false;
  const matches = () => (dismissed ? [] : slashMenu(cfg, io.value));
  const drawMenu = () => {
    if (io.value === "?") {
      const pad = Math.max(...cfg.shortcuts.map((x) => [...x.keys].length)) + 4;
      menu.innerHTML = cfg.shortcuts.map((x) => `<div class="row"><span class="text" style="--c:2">${esc(x.keys)}</span><span class="muted" style="--c:${pad}">${esc(x.what)}</span></div>`).join("");
      menu.hidden = false;
      return;
    }
    const m = matches();
    if (!m.length) { menu.hidden = true; menu.innerHTML = ""; return; }
    sel = Math.min(sel, m.length - 1);
    const pad = Math.max(...m.map((x) => [...x.cmd].length)) + 4;
    menu.innerHTML = m.map((x, i) => {
      const on = i === sel;
      return `<div class="row item${on ? " sel" : ""}" role="option" aria-selected="${on}" data-cmd="${esc(x.cmd)}">`
        + `<span class="${on ? "accent" : "text"}" style="--c:2">${esc(x.cmd)}</span>`
        + `<span class="muted" style="--c:${pad}">${esc(x.blurb)}</span></div>`;
    }).join("");
    menu.hidden = false;
  };

  // Only the prompt glyph is the template. The static row also carries the placeholder, and copying
  // that too drew "try /help" underneath every keystroke.
  const sigil = cmdline.querySelector(".accent")?.outerHTML ?? "";
  const paint = () => {
    const typed = io.value;
    cmdline.innerHTML = sigil
      + `<span class="text" style="--c:${cfg.inputCol}">${esc(typed)}</span>`
      + `<span class="caret" style="--c:${cfg.inputCol + [...typed].length}"> </span>`
      // The empty prompt suggests a start, muted, and gives way to the first keystroke.
      + (typed ? "" : `<span class="muted ph" style="--c:${cfg.inputCol + 1}">${esc(cfg.placeholder)}</span>`);
    drawMenu();
  };
  const setLine = (v: string) => { io.value = v; io.setSelectionRange(v.length, v.length); paint(); };

  const append = (html: string) => {
    log.insertAdjacentHTML("beforeend", html + `<div class="row"></div>`);
    toEnd();
  };

  /**
   * One turn. The visitor's line prints at once; then the agent "works" (a spinner, a cat verb and
   * the seconds) and its answer prints in line by line. Esc stops it, and says so. Reduced motion
   * gets the whole turn at once.
   */
  let working: { stop: () => void } | null = null;
  const turn = (rows: Row[]) => {
    if (still() || rows.length < 2) { append(renderRowsHtml(rows)); return; }
    const [you, ...answer] = rows;
    log.insertAdjacentHTML("beforeend", renderRowsHtml([you!]));
    const w = document.createElement("div");
    w.className = "row working";
    log.append(w);
    toEnd();
    const verb = cfg.verbs[Math.floor(Math.random() * cfg.verbs.length)]!;
    const t0 = performance.now();
    let frame = 0;
    const tick = () => {
      w.innerHTML = `<span class="muted" style="--c:0">${esc(workingLine(verb, frame++, Math.floor((performance.now() - t0) / 1000)))}</span>`;
    };
    tick();
    const spin = window.setInterval(tick, 110);
    const timers: number[] = [];
    const done = () => { working = null; log.insertAdjacentHTML("beforeend", `<div class="row"></div>`); toEnd(); };
    timers.push(window.setTimeout(() => {
      window.clearInterval(spin);
      w.remove();
      answer.forEach((r, i) => timers.push(window.setTimeout(() => {
        log.insertAdjacentHTML("beforeend", renderRowsHtml([r]));
        toEnd();
        if (i === answer.length - 1) done();
      }, i * 45)));
    }, 450 + Math.min(650, rows.length * 90)));
    working = {
      stop: () => {
        window.clearInterval(spin);
        timers.forEach((t) => window.clearTimeout(t));
        w.remove();
        log.insertAdjacentHTML("beforeend", renderRowsHtml([{ runs: [
          { col: 0, text: RESULT, style: "muted" }, { col: 2, text: cfg.interrupted, style: "muted" },
        ] }]));
        done();
      },
    };
  };

  /**
   * `/effort`: a panel in place of the input box that owns the keyboard while it is open. Rigged:
   * Enter walks the marker back to lazy, Tab turns Ultrachill off and then on again. `busy` covers
   * the walk and `flipping` the toggle's snap-back, so a second press cannot double either.
   */
  let panel: { s: EffortState; el: HTMLElement; busy: boolean; flipping: boolean } | null = null;
  const draw = () => { if (panel) panel.el.innerHTML = renderRowsHtml(effortRows(cfg.effort, panel.s)); };
  const openPanel = () => {
    box.insertAdjacentHTML("beforebegin", `<div id="effort"></div>`);
    panel = { s: openEffort(cfg.effort), el: document.querySelector<HTMLElement>("#effort")!, busy: false, flipping: false };
    box.style.display = "none";
    menu.hidden = true;
    draw();
    toEnd();
  };
  const closePanel = (call: string | undefined, result: string) => {
    panel?.el.remove();
    panel = null;
    box.style.display = "";
    append(renderRowsHtml(deflectionRows("/effort", { call, result, style: "muted" })));
    paint();
  };
  const confirm = () => {
    if (!panel || panel.busy) return;
    const p = panel;
    p.busy = true;
    const picked = p.s.at;
    const steps = still() ? slideBack(cfg.effort, picked).slice(-1) : slideBack(cfg.effort, picked);
    const finish = () => closePanel(cfg.effort.call, confirmReply(cfg.effort, picked));
    if (!steps.length) { finish(); return; }
    steps.forEach((at, i) => setTimeout(() => {
      p.s = { ...p.s, at };
      draw();
      if (i === steps.length - 1) setTimeout(finish, 240);
    }, (i + 1) * 120));
  };
  const toggle = () => {
    if (!panel || panel.busy || panel.flipping) return;
    const p = panel;
    p.flipping = true;
    p.s = { ...p.s, ultrachill: "off", note: "" };
    draw();
    setTimeout(() => {
      p.flipping = false;
      if (panel !== p) return;
      p.s = { ...p.s, ultrachill: "on", note: cfg.effort.loadBearing };
      draw();
    }, 600);
  };

  let history: string[] = [];
  let recall = new Recall(history);
  const submit = () => {
    const typed = io.value.trim();
    if (!typed || working) return;
    if (typed === "?") { setLine(""); return; }
    history = remember(history, typed);
    recall = new Recall(history);
    setLine("");
    if (normalize(typed) === "/effort") { openPanel(); return; }
    if (typed === "exit" || typed === "q") { window.location.assign("/"); return; }
    if (typed === "clear") { log.innerHTML = ""; return; }
    const known = normalize(typed) in cfg.output;
    turn(known ? exchangeRows(cfg, typed) : deflectionRows(typed, deflect(cfg, Math.random, typed)));
  };

  // Ctrl+C: stops the agent, else clears the line, else asks once before leaving.
  let armed = 0;
  const ctrlC = () => {
    if (working) { working.stop(); return; }
    if (io.value) { setLine(""); return; }
    if (armed) { window.location.assign("/"); return; }
    statusLeft.textContent = cfg.exitConfirm;
    armed = window.setTimeout(() => { armed = 0; statusLeft.textContent = cfg.shortcutsHint; }, 2000);
  };

  io.addEventListener("input", () => { dismissed = false; sel = 0; recall = new Recall(history); paint(); });
  io.addEventListener("keydown", (e) => {
    // Tab never leaves the page; inside the panel it is the Ultrachill toggle.
    if (e.key === "Tab") e.preventDefault();
    if (panel) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (panel.busy) return;
      if (e.key === "ArrowLeft") { panel.s = move(cfg.effort, panel.s, -1); draw(); }
      else if (e.key === "ArrowRight") { panel.s = move(cfg.effort, panel.s, 1); draw(); }
      else if (e.key === "Enter") confirm();
      else if (e.key === "Tab") toggle();
      else if (e.key === "Escape") closePanel(undefined, cfg.effort.cancel);
      return;
    }
    if (e.ctrlKey && (e.key === "c" || e.key === "C") && !window.getSelection()?.toString()) { e.preventDefault(); ctrlC(); return; }
    const m = matches();
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const d = e.key === "ArrowUp" ? -1 : 1;
      if (m.length) { sel = (sel + d + m.length) % m.length; drawMenu(); return; }
      const v = d < 0 ? recall.up(io.value) : recall.down();
      io.value = v;
      io.setSelectionRange(v.length, v.length);
      dismissed = true;
      paint();
      return;
    }
    if (e.key === "Tab" && m.length) { setLine(m[sel]!.cmd); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      // A half-typed command with the menu open runs the pick, the way an agent CLI does.
      if (m.length && normalize(io.value) !== normalize(m[sel]!.cmd)) io.value = m[sel]!.cmd;
      submit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (working) working.stop();
      else if (m.length) { dismissed = true; drawMenu(); }
      else if (io.value) setLine("");
      else window.location.assign("/");
    }
  });
  const focus = () => { io.focus({ preventScroll: true }); term.dataset.focus = "on"; };
  io.addEventListener("focus", () => { term.dataset.focus = "on"; });
  io.addEventListener("blur", () => { term.dataset.focus = "off"; });
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Element | null;
    // Phones have no arrow keys: a tapped level is picked and confirmed, a tapped Ultrachill toggles.
    const hit = target?.closest(".eff-lv, .eff-toggle");
    if (panel && hit && !panel.busy) {
      const lv = /eff-lv-(\d+)/.exec(hit.className);
      if (lv) { panel.s = { ...panel.s, at: Number(lv[1]) }; draw(); confirm(); } else toggle();
    }
    // A tapped menu entry runs, which is the only way to pick one without arrow keys.
    const item = target?.closest<HTMLElement>("#menu .item");
    if (item?.dataset.cmd) { e.preventDefault(); io.value = item.dataset.cmd; submit(); focus(); return; }
    if (target?.closest("a")) return;
    if (!window.getSelection()?.toString()) focus();
  });

  paint();
  focus();
  reveal(cfg, log);
}

/**
 * The boot sequence, and the reason anime.js is in this repo.
 *
 * The exchange is ALREADY IN THE DOCUMENT, so a crawler, a text browser and a reader with
 * JavaScript off all have it; the timeline only reveals what is there. Which means the one thing
 * this must never do is leave content hidden, so the final state is set by a function the catch
 * block and a safety timer can both call, and the motion is the only part that depends on anime.
 *
 * Skipping is a seek to the end rather than a cancel, because the end state is the real state.
 */
function reveal(cfg: Cfg, log: HTMLElement): void {
  const rows = [...log.querySelectorAll<HTMLElement>(".row.boot")];
  if (!rows.length) return;
  const typedSpan = rows[0]?.querySelector<HTMLElement>("span:last-child");
  const callSpan = rows[1]?.querySelector<HTMLElement>("span:last-child");
  const full = typedSpan?.textContent ?? "";
  const call = callSpan?.textContent ?? "";

  const finalise = () => {
    for (const r of rows) r.style.opacity = "1";
    if (typedSpan) typedSpan.textContent = full;
    if (callSpan) callSpan.textContent = call;
  };

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const safety = window.setTimeout(finalise, 2500);
  try {
    for (const r of rows.slice(1)) r.style.opacity = "0";
    if (typedSpan) typedSpan.textContent = "";

    const typing = { n: 0 };
    const tl = createTimeline({ autoplay: true });
    tl.add(typing, {
      n: [...full].length,
      duration: 300,
      ease: "linear",
      onUpdate: () => { if (typedSpan) typedSpan.textContent = [...full].slice(0, Math.round(typing.n)).join(""); },
    });
    // The spinner, in the agent's own verbs: they are the owner's words bound to the Mascot's
    // poses, which is what ADR 0002 requires instead of borrowing anyone's list.
    const spin = { i: 0 };
    tl.add(rows[1]!, { opacity: [0, 1], duration: 120 });
    tl.add(spin, {
      i: cfg.verbs.length * 2,
      duration: 420,
      ease: "linear",
      onUpdate: () => {
        if (callSpan) callSpan.textContent = `${cfg.verbs[Math.floor(spin.i) % cfg.verbs.length]}…`;
      },
      onComplete: () => { if (callSpan) callSpan.textContent = call; },
    });
    for (const r of rows.slice(2)) tl.add(r, { opacity: [0, 1], duration: 180 }, "-=100");

    const skip = () => {
      window.clearTimeout(safety);
      try { tl.seek(tl.duration); tl.pause(); } catch { /* the end state is set below either way */ }
      finalise();
      document.removeEventListener("keydown", skip);
      document.removeEventListener("pointerdown", skip);
    };
    document.addEventListener("keydown", skip, { once: true });
    document.addEventListener("pointerdown", skip, { once: true });
    tl.then?.(() => { window.clearTimeout(safety); finalise(); });
  } catch {
    window.clearTimeout(safety);
    finalise();
  }
}
