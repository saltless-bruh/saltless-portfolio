import { createTimeline } from "animejs";
import { renderRowsHtml } from "../rows.ts";
import { openEffort, move, slideBack, effortRows, confirmReply, type EffortState } from "./effort.ts";
import {
  PROMPT, exchangeRows, deflect, deflectionRows, normalize, type NappingCfg,
} from "../napping.ts";

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
  const cmdline = document.querySelector<HTMLElement>("#prompt .cmdline");
  if (!term || !log || !cmdline) return;

  const sigil = cmdline.innerHTML;
  const paint = () => {
    const typed = io.value;
    cmdline.innerHTML = sigil
      + `<span class="text" style="--c:${cfg.inputCol}">${esc(typed)}</span>`
      + `<span class="caret" style="--c:${cfg.inputCol + [...typed].length}"> </span>`;
  };

  const append = (html: string) => {
    log.insertAdjacentHTML("beforeend", html + `<div class="row"></div>`);
    cmdline.scrollIntoView({ block: "nearest" });
  };

  /**
   * `/effort`: a panel in place of the prompt that owns the keyboard while it is open. Rigged:
   * Enter walks the marker back to lazy, Tab turns Ultrachill off and then on again. `busy` covers
   * the walk and `flipping` the toggle's snap-back, so a second press cannot double either.
   */
  let panel: { s: EffortState; el: HTMLElement; busy: boolean; flipping: boolean } | null = null;
  const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const draw = () => { if (panel) panel.el.innerHTML = renderRowsHtml(effortRows(cfg.effort, panel.s)); };
  const openPanel = () => {
    cmdline.insertAdjacentHTML("beforebegin", `<div id="effort"></div>`);
    panel = { s: openEffort(cfg.effort), el: document.querySelector<HTMLElement>("#effort")!, busy: false, flipping: false };
    cmdline.style.display = "none";
    draw();
    panel.el.scrollIntoView({ block: "nearest" });
  };
  const closePanel = (call: string | undefined, result: string) => {
    panel?.el.remove();
    panel = null;
    cmdline.style.display = "";
    append(renderRowsHtml(deflectionRows("/effort", { call, result, style: "muted" })));
    paint();
  };
  const confirm = () => {
    if (!panel || panel.busy) return;
    const p = panel;
    p.busy = true;
    const picked = p.s.at;
    const steps = still() ? slideBack(cfg.effort, picked).slice(-1) : slideBack(cfg.effort, picked);
    const done = () => closePanel(cfg.effort.call, confirmReply(cfg.effort, picked));
    if (!steps.length) { done(); return; }
    steps.forEach((at, i) => setTimeout(() => {
      p.s = { ...p.s, at };
      draw();
      if (i === steps.length - 1) setTimeout(done, 240);
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

  const submit = () => {
    const typed = io.value.trim();
    if (!typed) return;
    if (normalize(typed) === "/effort") { io.value = ""; paint(); openPanel(); return; }
    if (typed === "exit" || typed === "q") { window.location.assign("/"); return; }
    if (typed === "clear") { log.innerHTML = ""; io.value = ""; paint(); return; }
    const known = normalize(typed) in cfg.output;
    append(renderRowsHtml(known ? exchangeRows(cfg, typed) : deflectionRows(typed, deflect(cfg, Math.random, typed))));
    io.value = "";
    paint();
  };

  io.addEventListener("input", paint);
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
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Escape") { e.preventDefault(); window.location.assign("/"); }
  });
  const focus = () => { io.focus({ preventScroll: true }); term.dataset.focus = "on"; };
  io.addEventListener("focus", () => { term.dataset.focus = "on"; });
  io.addEventListener("blur", () => { term.dataset.focus = "off"; });
  document.addEventListener("pointerdown", (e) => {
    // Phones have no arrow keys: a tapped level is picked and confirmed, a tapped Ultrachill toggles.
    const hit = (e.target as Element)?.closest(".eff-lv, .eff-toggle");
    if (panel && hit && !panel.busy) {
      const lv = /eff-lv-(\d+)/.exec(hit.className);
      if (lv) { panel.s = { ...panel.s, at: Number(lv[1]) }; draw(); confirm(); } else toggle();
    }
    if ((e.target as Element)?.closest("a")) return;
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
