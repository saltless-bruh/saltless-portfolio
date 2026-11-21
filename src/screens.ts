import type { Content } from "./content.ts";
import type { Row } from "./rows.ts";
import { COLS_NARROW } from "./grid.ts";
import type { NappingCfg } from "./napping.ts";
import { readFileSync } from "node:fs";
import { train } from "./client/brain.ts";

const blank = (): Row => ({ runs: [] });
const line = (text: string, style?: Row["runs"][number]["style"], col = 0): Row =>
  ({ runs: [{ col, text, style }] });

/**
 * Panels are COLS_NARROW wide, which is the authoring floor rather than a taste.
 *
 * A box drawn 70 columns across puts its right edge off-screen at 40 columns, where a border is
 * structure and cannot wrap the way prose does. A narrow panel in a wide window is also what an
 * unmaximised TUI actually looks like, so the constraint and the aesthetic agree for once.
 */
const W = COLS_NARROW;

function panel(title: string, body: Row[]): Row[] {
  const head = `┌─ ${title} `;
  const top = head + "─".repeat(Math.max(0, W - [...head].length - 1)) + "┐";
  const bottom = "└" + "─".repeat(W - 2) + "┘";
  const wrapped = body.map((r): Row => ({
    cls: r.cls,
    runs: [
      { col: 0, text: "│", style: "muted" },
      ...r.runs.map((run) => ({ ...run, col: run.col + 2 })),
      { col: W - 1, text: "│", style: "muted" },
    ],
  }));
  return [line(top, "muted"), ...wrapped, line(bottom, "muted")];
}

/** The résumé. One screen, and everything on it is a fact the repository already holds. */
export function resumeRows(c: Content): Row[] {
  const r = c.resume;
  const rows: Row[] = [line("resume", "accent-bold"), blank()];
  for (const l of r.role) rows.push(line(l));
  rows.push(blank(), line("stack", "accent"));
  const pad = Math.max(...r.stack.map((s) => s.label.length)) + 2;
  for (const s of r.stack) {
    rows.push({ runs: [
      { col: 2, text: s.label, style: "muted" },
      { col: 2 + pad, text: s.items.join("  ") },
    ] });
  }
  rows.push(blank(), line("projects", "accent"));
  for (const lane of r.lanes) {
    rows.push(line(lane.label, "muted", 2));
    // Name and blurb stack rather than sharing a line. A blurb set beside the longest repo name
    // starts past column 30 and runs to 90, which no terminal shows and 40 columns cannot wrap
    // without tearing the name off its description.
    for (const repo of lane.repos) {
      rows.push(line(repo.name, "text", 4));
      rows.push(line(repo.blurb, "muted", 6));
    }
    rows.push(blank());
  }
  rows.pop();
  rows.push(blank(), line("links", "accent"));
  for (const l of r.links) rows.push({ runs: [
    { col: 2, text: l.label, style: "muted" },
    { col: 12, text: l.href, style: "text", cls: `lk:${l.href}` },
  ] });
  return rows;
}


/** The note is prose, so it is pre-wrapped to the panel width rather than left to the browser. */
function wrapNote(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && [...cur].length + 1 + [...word].length > W) { out.push(cur); cur = word; }
    else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * What this site records, which today is nothing.
 *
 * The page states the CURRENT truth and keeps the future in its own section. A privacy page that
 * describes behaviour the code does not have is a false statement however good the intention behind
 * it, and this is the one screen where that matters most.
 */
export function privacyRows(c: Content): Row[] {
  const rows: Row[] = [line("privacy", "accent-bold"), blank()];
  for (const section of c.privacy) {
    rows.push(line(section.heading, "accent"));
    for (const l of section.lines) rows.push(l ? line(l, "text", 2) : blank());
    rows.push(blank());
  }
  rows.pop();
  return rows;
}

/** The funnel's end. Thin today because the domain does not exist yet, and saying so is the point. */
export function contactRows(c: Content): Row[] {
  const rows: Row[] = [line("contact", "accent-bold"), blank()];
  const pad = Math.max(...c.contact.links.map((l) => l.label.length)) + 4;
  for (const l of c.contact.links) {
    rows.push({ runs: [
      { col: 2, text: l.label, style: "muted" },
      { col: 2 + pad, text: l.href, style: "accent", cls: "lk" },
    ] });
  }
  rows.push(blank());
  for (const l of c.contact.note) rows.push(line(l, "muted", 2));
  return rows;
}

/**
 * The agent's runtime config, with every command's output PRECOMPUTED at build time.
 *
 * The client renders the same exchanges the prerendered page already contains, so composing them
 * from the full content model twice, once here and once in the browser, would be two chances to
 * disagree. It also keeps the bundle from needing the content model at all.
 */
export function nappingCfg(c: Content): NappingCfg {
  const n = c.napping;
  const output: Record<string, string[]> = {
    "/status": [`model:  ${n.model}`, `status: ${n.status}`],
    "/help": n.commands.map((x) => `${x.cmd.padEnd(14)}${x.blurb}`),
  };
  // A group lists its repos by name; `group name` gives the repo's line and where it lives. The
  // offense lane is the terminal's, so no group names it.
  for (const g of n.groups) {
    const lane = c.resume.lanes.find((l) => l.label === g.lane);
    if (!lane) throw new Error(`content.json: napping.groups ${g.cmd} names lane ${g.lane}, which resume.lanes lacks`);
    const repos = lane.repos;
    output[g.cmd] = [repos.map((r) => r.name).join("  ")];
    for (const r of repos) output[`${g.cmd} ${r.name}`] = [r.blurb, `${n.repoBase}${r.name}`];
  }
  const examples = JSON.parse(readFileSync(new URL("../brain/examples.json", import.meta.url), "utf8")) as { train: Record<string, string[]> };
  return {
    version: n.version, model: n.model, status: n.status, verbs: n.verbs, boot: n.boot,
    commands: n.commands, calls: n.calls, deflect: n.deflect, output, brain: train(examples.train), effort: n.effort,
  };
}
