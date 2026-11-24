import { MONITORS, CAT, LEDS, SCENE, NARROW, zoomTransform, catFrame, planEnter, roomKey, type Rect } from "../room.ts";

/**
 * The room on `/` (docs/superpowers/specs/2026-11-21-room-home-design.md). The scene is a still
 * image; this draws the little that moves over it, and owns the way in: a click on the main
 * monitor, or Enter, zooms into it and hands the page to the shell; the vertical monitor zooms
 * into napping. `html.room` (set by ROOM_GATE before first paint) means the room covers the
 * window; without it the room is a banner above a live shell and nothing zooms.
 */
export function bootRoom(opts: { onEnter: () => void }): { zoomOut: () => void } | null {
  const root = document.documentElement;
  const frame = document.querySelector<HTMLElement>("#room .room-frame");
  const canvas = document.querySelector<HTMLCanvasElement>("#room-fx");
  const g = canvas?.getContext("2d");
  if (!frame || !canvas || !g) return null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = matchMedia(NARROW);
  const up = () => root.classList.contains("room");

  // ---- the ambient layer, in scene pixels
  const sheet = new Image();
  sheet.src = "/room/cat-sheet.png";
  const t0 = performance.now();
  let k = 0;
  const box = (m: Rect, c: string) => {
    g.fillStyle = c;
    g.fillRect(m.x - 1, m.y - 1, m.w + 2, 1); g.fillRect(m.x - 1, m.y + m.h, m.w + 2, 1);
    g.fillRect(m.x - 1, m.y, 1, m.h); g.fillRect(m.x + m.w, m.y, 1, m.h);
  };
  const draw = () => {
    k++;
    g.clearRect(0, 0, SCENE.w, SCENE.h);
    const sec = reduced ? 0 : (performance.now() - t0) / 1000;
    if (sheet.complete && sheet.naturalWidth) g.drawImage(sheet, catFrame(sec) * CAT.w, 0, CAT.w, CAT.h, CAT.x, CAT.y, CAT.w, CAT.h);
    if (!reduced) {
      // a dim zZz drifting up from the cat's head
      for (let j = 0; j < 3; j++) {
        const ph = (k / 10 + j * 1.4) % 4.2, zx = CAT.x - 2 - Math.floor(ph * 1.5), zy = CAT.y + 2 - Math.floor(ph * 3.2);
        g.fillStyle = ph > 3.2 ? "#414b50" : "#56635f";
        g.fillRect(zx, zy, 3, 1); g.fillRect(zx + 1, zy + 1, 1, 1); g.fillRect(zx, zy + 2, 3, 1);
      }
      LEDS.forEach(([x, y], j) => { if ((k + j * 5) % 11 < 3) { g.fillStyle = "#1e2326"; g.fillRect(x, y, 1, 1); } });
    }
    // the shell waiting on the main monitor: a few lines and a caret
    const m = MONITORS.main;
    g.fillStyle = "#1e2326"; g.fillRect(m.x + 1, m.y + 1, m.w - 2, m.h - 2);
    ([["#83c092", 14], ["#9da9a0", 22], ["#dbbc7f", 9], ["#7fbbb3", 17]] as const).forEach(([c, w], j) => { g.fillStyle = c; g.fillRect(m.x + 2, m.y + 2 + j * 2, w, 1); });
    g.fillStyle = "#9da9a0"; g.fillRect(m.x + 2, m.y + 11, 4, 1);
    if (reduced || k % 8 < 4) { g.fillStyle = "#83c092"; g.fillRect(m.x + 7, m.y + 11, 2, 1); }
    // the slow pulse round the screen that says this is the way in
    if (up() && !reduced && Math.floor(k / 6) % 2) box(m, "rgba(131,192,146,.55)");
  };
  sheet.addEventListener("load", draw);
  draw();
  if (!reduced) setInterval(draw, 110);

  // ---- entering
  let busy = false;
  const toMonitor = (which: "main" | "side", animate: boolean) => {
    const r = frame.getBoundingClientRect();
    const t = zoomTransform(MONITORS[which], { left: r.left, top: r.top, width: r.width }, { width: innerWidth, height: innerHeight });
    root.classList.toggle("zooming", animate);
    frame.style.transform = `translate(${t.tx}px, ${t.ty}px) scale(${t.s})`;
  };
  const remember = (key: string, on: boolean) => { try { if (on) sessionStorage.setItem(key, "1"); else sessionStorage.removeItem(key); } catch { /* the room shows again next time */ } };
  const enter = (which: "main" | "side") => {
    const plan = planEnter(which, reduced);
    if (!up()) {
      // The banner: no camera, just the way in.
      if (plan.then === "/napping/") location.assign("/napping/");
      else { const io = document.querySelector<HTMLInputElement>("#io"); io?.focus({ preventScroll: true }); document.querySelector("#prompt")?.scrollIntoView({ block: "center" }); }
      return;
    }
    if (busy) return;
    busy = true;
    toMonitor(which, plan.animate);
    setTimeout(() => {
      remember("lazie:dark", true);
      root.dataset.theme = "dark";
      if (plan.then === "/napping/") { location.assign("/napping/"); return; }
      remember("lazie:entered", true);
      root.classList.remove("room", "zooming");
      root.classList.add("entered");
      frame.style.transform = "";
      busy = false;
      opts.onEnter();
    }, plan.animate ? 820 : 0);
  };
  document.querySelectorAll<HTMLButtonElement>("#room .room-mon").forEach((b) => {
    b.addEventListener("click", () => enter(b.dataset.mon === "side" ? "side" : "main"));
  });
  // While the room covers the window, the keyboard is the room's: Enter goes in, Tab reaches the
  // monitors, and nothing types into the shell hidden underneath.
  document.addEventListener("keydown", (e) => {
    if (!up() || roomKey(e) !== "enter") return;
    if (e.target instanceof HTMLButtonElement && e.target.closest("#room")) return;   // the button's own click
    e.preventDefault();
    e.stopImmediatePropagation();
    enter("main");
  }, true);
  // Back from napping: the browser restores this page as it was left, zoomed into a monitor with
  // `busy` set. Put the room back as it was before the click.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    busy = false;
    root.classList.remove("zooming");
    frame.style.transform = "";
  });
  // Turned narrow while the room was up (a resize, a rotation): drop to the banner, shell live.
  narrow.addEventListener("change", () => {
    if (!narrow.matches || !up()) return;
    root.classList.remove("room", "zooming");
    frame.style.transform = "";
    opts.onEnter();
  });

  root.classList.add("room-live");   // the gate's deadline: the room is alive, it may stay

  // ---- `exit`: back out to the room
  const zoomOut = () => {
    if (narrow.matches) return;
    remember("lazie:entered", false);
    root.classList.remove("entered");
    root.classList.add("room");
    if (reduced) { frame.style.transform = ""; return; }
    toMonitor("main", false);
    void frame.offsetWidth;            // the zoomed-in state is painted first, then animated away
    root.classList.add("zooming");
    frame.style.transform = "";
    setTimeout(() => root.classList.remove("zooming"), 950);
  };
  return { zoomOut };
}
