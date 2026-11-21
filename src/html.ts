import type { Content } from "./content.ts";
import { css } from "./css.ts";
import { renderRowsHtml } from "./rows.ts";
import { motdRows } from "./motd.ts";
import { promptRows, INPUT_COL } from "./shell.ts";
import { resumeRows, privacyRows, contactRows, nappingCfg } from "./screens.ts";
import type { Node } from "./client/fs.ts";
import { run, type Cfg } from "./client/commands.ts";
import { bootSchedule, bootCss, BOOT_GATE } from "./boot.ts";
import { startupRows, exchangeRows, nappingRows, AGENT_INPUT_COL } from "./napping.ts";
import { mascotSvg } from "./mascot.ts";
import { PROMPT as AGENT_PROMPT } from "./napping.ts";
import type { Row } from "./rows.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The Shell as a real document (ADR 0001 here): the content is in the first response, and the
 * client script attaches behaviour to this same DOM afterwards. That is what makes 400ms possible,
 * and it is also the plain linear presentation a full-screen terminal interface owes a screen
 * reader, so there is no second accessible version to build or to let rot.
 */
function doc(c: Content, font: string, title: string, bodyHtml: string, cfg: string, head = ""): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}<title>${esc(title)}</title>
<meta name="description" content="offensive security and agentic AI systems. the shell is the router.">
<style>${css(font)}</style>
<body>
<div class="screen">
${bodyHtml}
</div>
<script type="application/json" id="cfg">${cfg.replace(/</g, "\\u003c")}</script>
<script type="module" src="/app.js"></script>
</body>
</html>
`;
}

/** The ops/ tree, read once per build: the shell walks it in the browser. */

const config = (c: Content, active: string | null, fs?: Node, bootEnd = 0): string =>
  JSON.stringify({
    screens: c.screens, notFound: c.notFound, sudo: c.sudo,
    hint: c.hint, back: c.back, inputCol: INPUT_COL, active,
    ...(active === null ? { bootEnd, fs, emptyNote: c.emptyDir, home: `~/${c.login}`, filesHelp: c.filesHelp } : {}),
    napping: active === "napping" ? { ...nappingCfg(c), inputCol: AGENT_INPUT_COL } : undefined,
  });

/** The agent screen. Its boot exchange is already in the document; the timeline only reveals it. */
export function nappingHtml(c: Content, font: string): string {
  const cfg = nappingCfg(c);
  const body = `  <main class="term agent" id="term" data-focus="off">
    <div id="head">
      <div class="agent-head">
        ${mascotSvg()}
        <div class="startup">
${renderRowsHtml(startupRows(cfg))}
        </div>
      </div>
      <div class="row"></div>
    </div>
    <div id="log" aria-live="polite">
${renderRowsHtml(exchangeRows(cfg, cfg.boot, "boot"))}
      <div class="row"></div>
    </div>
    <div id="band">
      <div id="prompt">
        <div class="row cmdline"><span class="accent" style="--c:0">${esc(AGENT_PROMPT)}</span><span class="muted ph" style="--c:${AGENT_INPUT_COL + 1}">${esc(cfg.placeholder)}</span></div>
      </div>
      <div class="row band-hint"><span class="muted" style="--c:0">${esc(cfg.footer)}</span></div>
    </div>
  </main>
  <label class="io" for="io">command</label>
  <input class="io" id="io" autocomplete="off" autocapitalize="off" autocorrect="off"
         spellcheck="false" enterkeyhint="go">`;
  return doc(c, font, `napping \u00b7 ${c.handle}`, body, config(c, "napping"));
}

/** A focused screen: content, then the window bar, then the way back out. */
export type StaticScreen = "resume" | "privacy" | "contact";
const COMPOSE: Record<StaticScreen, (c: Content) => Row[]> = {
  resume: resumeRows, privacy: privacyRows, contact: contactRows,
};

export function screenHtml(c: Content, font: string, cmd: StaticScreen): string {
  const rows: Row[] = COMPOSE[cmd](c);
  const body = `  <main class="term" id="term">
${renderRowsHtml(rows)}
  </main>`;
  return doc(c, font, `${cmd} \u00b7 ${c.handle}`, body, config(c, cmd));
}

/**
 * A document from `ops/`, rendered: the page `cat file.md` opens. A focused screen, so `q` or Esc
 * goes back to the shell, and its own address, so a writeup can be linked straight from a CV.
 */
export function readerHtml(c: Content, font: string, title: string, bodyHtml: string, path: string): string {
  const body = `  <main class="term reader" id="term">
    <div class="row"><span class="muted" style="--c:0">${esc(`cat ${path}`)}</span></div>
    <article class="md">
${bodyHtml}
    </article>
    <div class="row"></div>
    <div class="row"><span class="muted" style="--c:0">q / Esc · back to the shell</span></div>
  </main>`;
  return doc(c, font, `${title} \u00b7 ${c.handle}`, body, config(c, "reader"));
}

/**
 * What Cloudflare serves for an address nothing lives at (`not_found_handling: "404-page"`). One
 * page answers every depth, so it names no path and loads its script absolutely; a focused screen,
 * so `q` or Esc is the way home.
 */
export function notFoundHtml(c: Content, font: string): string {
  const body = `  <main class="term" id="term">
${renderRowsHtml([
    { runs: [{ col: 0, text: "zsh: no such file or directory", style: "error" }] },
    { runs: [] },
    { runs: [{ col: 0, text: "q / Esc · back to the shell", style: "muted" }] },
  ])}
  </main>`;
  return doc(c, font, `404 · ${c.handle}`, body, config(c, "404"));
}

/**
 * The shell page, with its boot already written in: the MOTD under the wordmark, then `help` typed
 * and answered, then the live prompt. Each revealed piece carries a class the boot schedule times;
 * the wordmark carries none, so it is on screen at first paint.
 */
export function shellHtml(c: Content, fontWoff2Base64: string, fs: Node): string {
  const typed = "help";
  const cfg: Cfg = {
    screens: c.screens, notFound: c.notFound, sudo: c.sudo, hint: c.hint, back: c.back, inputCol: INPUT_COL,
    fs, emptyNote: c.emptyDir, home: `~/${c.login}`, filesHelp: c.filesHelp,
  };
  const answer = run(typed, cfg);
  const helpRows = answer.kind === "rows" ? answer.rows : [];

  const motdAll = motdRows(c);
  const mast = motdAll.map((r) => r.cls === "bn").lastIndexOf(true);
  let m = 0;
  const motdTagged = motdAll.map((r, i) => (i <= mast || r.runs.length === 0 ? r : { ...r, cls: [r.cls, "b", `bm-${m++}`].filter(Boolean).join(" ") }));
  const [head, cmdline] = promptRows(c);
  const echo: Row[] = [
    { cls: "b be", runs: head!.runs.map((r) => ({ ...r, cls: undefined })) },
    { runs: [
      { ...cmdline!.runs[0]!, cls: "b be" },
      ...[...typed].map((ch, i) => ({ col: INPUT_COL + i, text: ch, cls: `b bt-${i}` })),
    ] },
    ...helpRows.map((r, i) => ({ ...r, cls: [r.cls, "b", `bh-${i}`].filter(Boolean).join(" ") })),
    { runs: [] },
  ];
  const s = bootSchedule({ motd: m, typed: [...typed].length, help: helpRows.length });

  const motd = renderRowsHtml(motdTagged);
  const prompt = renderRowsHtml(promptRows(c));
  const body = `  <main class="term" id="term" data-focus="off">
    <div id="motd" role="group" aria-label="login message">
${motd}
    </div>
    <div class="row"></div>
    <div id="log" aria-live="polite" aria-atomic="false">
${renderRowsHtml(echo)}
    </div>
    <div id="prompt" class="b bp">
${prompt}
    </div>
    <div class="row"></div>
    <div class="row hint b bk" id="hint"><span class="muted" style="--c:0">${esc(c.hint)}</span></div>
  </main>
  <label class="io" for="io">command</label>
  <input class="io" id="io" autocomplete="off" autocapitalize="off" autocorrect="off"
         spellcheck="false" enterkeyhint="go" aria-describedby="hint">`;
  return doc(c, fontWoff2Base64, c.handle, body, config(c, null, fs, s.prompt), `${BOOT_GATE}\n<style>${bootCss(s)}</style>\n`);
}


