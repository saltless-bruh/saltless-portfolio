import { readFileSync } from "node:fs";
import type { Row } from "./rows.ts";
import { rowsToFullText } from "./rows.ts";

export type BootState = "ok" | "failed" | "note";
export type BootLine = { state: BootState; text: string };
export type ScreenEntry = { cmd: string; blurb: string };
export type StackRow = { label: string; items: string[] };
export type Repo = { name: string; blurb: string };
export type Lane = { label: string; repos: Repo[] };
export type Link = { label: string; href: string };
export type Resume = { role: string[]; stack: StackRow[]; lanes: Lane[]; links: Link[] };
export type Section = { heading: string; lines: string[] };
export type ContactContent = { links: Link[]; note: string[] };
import type { EffortCfg } from "./client/effort.ts";

export type NappingContent = {
  effort: EffortCfg;
  version: string; model: string; status: string; verbs: string[]; boot: string;
  /** The empty prompt's muted suggestion, and the hint line under the input band. */
  placeholder: string; footer: string;
  commands: { cmd: string; blurb: string }[];
  calls: Record<string, string>;
  /** Which résumé lane each group command lists. */
  groups: { cmd: string; lane: string }[];
  repoBase: string;
  deflect: {
    maxWords: number; maxChars: number; long: string; auth: string; unknown: string;
    offtopic: string; injection: string; about: string; greeting: string;
    /** The pretend model asking the human, who is asleep: when unsure, and one time in `escapeOdds`. */
    humanCall: string; humanEscape: string; unsureBelow: number; escapeOdds: number;
  };
};

export type Content = {
  handle: string;
  login: string;
  version: string;
  prompt: { user: string; host: string };
  panel: { uptime: string };
  boot: BootLine[];
  lastLogin: string;
  hint: string;
  /** The way out of every focused screen, said once: as the last line of `help`. */
  back: string;
  screens: ScreenEntry[];
  notFound: string;
  sudo: string[];
  resume: Resume;
  /** What `ls` says about an empty folder in ops/. */
  emptyDir: string;
  filesHelp: { cmd: string; blurb: string };
  napping: NappingContent;
  privacy: Section[];
  contact: ContactContent;
};

/**
 * ADR 0001 lives in the profile repo and governs both surfaces: the real name is never rendered.
 * The shape here mirrors its 2026-10-02 amendment exactly, because that amendment is the decision
 * and a copy that quietly re-tightens it would be a different policy wearing the same name.
 *
 * - The committed half is a placeholder, so no real spelling is ever in the tree.
 * - The private half comes from the environment, and is OFF unless the owner sets it.
 * - With nothing configured the scan reports that it checked for nothing, which is NOT the same
 *   claim as the tree being clean. That distinction is the whole point of the wording.
 */
export const COMMITTED_FORBIDDEN_NAMES = ["Firstname Lastname"] as const;
export const FORBIDDEN_NAMES_ENV = "SITE_FORBIDDEN_NAMES";

const configured = (): string[] =>
  (process.env[FORBIDDEN_NAMES_ENV] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const FORBIDDEN_NAMES: readonly string[] = [...COMMITTED_FORBIDDEN_NAMES];

/** Every name to scan for right now: the placeholder always, plus whatever the environment adds. */
export const forbiddenNames = (): string[] => [...COMMITTED_FORBIDDEN_NAMES, ...configured()];

export function assertNoForbiddenNames(text: string, where: string): void {
  for (const name of forbiddenNames()) {
    if (text.includes(name)) {
      throw new Error(`a forbidden name reached ${where} (ADR 0001)`);
    }
  }
}

/**
 * The COMPLETE projection of the rows, never the drawn one: text a row carries but the page does
 * not paint is still text, and the profile learned that the hard way (ADR 0001, "it is checked in
 * three places, not one").
 */
export function assertRowsCarryNoForbiddenNames(rows: Row[], where: string): void {
  assertNoForbiddenNames(rowsToFullText(rows), where);
}

const DEFAULT_PATH = new URL("../content.json", import.meta.url);

const str = (v: unknown, key: string): string => {
  if (typeof v !== "string" || !v.length) throw new Error(`content.json: ${key} must be a non-empty string`);
  return v;
};
const arr = (v: unknown, key: string): unknown[] => {
  if (!Array.isArray(v) || !v.length) throw new Error(`content.json: ${key} must be a non-empty array`);
  return v;
};
const obj = (v: unknown, key: string): Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`content.json: ${key} must be an object`);
  return v as Record<string, unknown>;
};

const BOOT_STATES = new Set<string>(["ok", "failed", "note"]);

export function validateContent(raw: unknown): Content {
  const c = obj(raw, "(root)");
  const prompt = obj(c.prompt, "prompt");
  const panel = obj(c.panel, "panel");
  const boot = arr(c.boot, "boot").map((v, i) => {
    const b = obj(v, `boot[${i}]`);
    const state = str(b.state, `boot[${i}].state`);
    if (!BOOT_STATES.has(state)) throw new Error(`content.json: boot[${i}].state must be ok, failed or note`);
    return { state: state as BootState, text: str(b.text, `boot[${i}].text`) };
  });
  const screens = arr(c.screens, "screens").map((v, i) => {
    const s = obj(v, `screens[${i}]`);
    return { cmd: str(s.cmd, `screens[${i}].cmd`), blurb: str(s.blurb, `screens[${i}].blurb`) };
  });
  const cmds = new Set(screens.map((s) => s.cmd));
  if (cmds.size !== screens.length) throw new Error("content.json: two screens share a cmd, so one URL has two meanings");
  const sudo = arr(c.sudo, "sudo").map((v, i) => str(v, `sudo[${i}]`));
  if (sudo.length !== 2) throw new Error("content.json: sudo is the real message and the owner's reply, two lines");

  const r = obj(c.resume, "resume");
  const resume: Resume = {
    role: arr(r.role, "resume.role").map((v, i) => str(v, `resume.role[${i}]`)),
    stack: arr(r.stack, "resume.stack").map((v, i) => {
      const o = obj(v, `resume.stack[${i}]`);
      if (typeof o.label !== "string") throw new Error(`content.json: resume.stack[${i}].label must be a string`);
      return { label: o.label, items: arr(o.items, `resume.stack[${i}].items`).map((x, j) => str(x, `resume.stack[${i}].items[${j}]`)) };
    }),
    lanes: arr(r.lanes, "resume.lanes").map((v, i) => {
      const o = obj(v, `resume.lanes[${i}]`);
      return {
        label: str(o.label, `resume.lanes[${i}].label`),
        repos: arr(o.repos, `resume.lanes[${i}].repos`).map((x, j) => {
          const rp = obj(x, `resume.lanes[${i}].repos[${j}]`);
          return { name: str(rp.name, `…repos[${j}].name`), blurb: str(rp.blurb, `…repos[${j}].blurb`) };
        }),
      };
    }),
    links: arr(r.links, "resume.links").map((v, i) => {
      const o = obj(v, `resume.links[${i}]`);
      const href = str(o.href, `resume.links[${i}].href`);
      if (!href.startsWith("https://")) throw new Error(`content.json: resume.links[${i}].href must be https`);
      return { label: str(o.label, `resume.links[${i}].label`), href };
    }),
  };

  const n = obj(c.napping, "napping");
  const nd = obj(n.deflect, "napping.deflect");
  const num = (v: unknown, key: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new Error(`content.json: ${key} must be a positive number`);
    return v;
  };
  const napping: NappingContent = {
    version: str(n.version, "napping.version"),
    model: str(n.model, "napping.model"),
    status: str(n.status, "napping.status"),
    verbs: arr(n.verbs, "napping.verbs").map((v, i) => str(v, `napping.verbs[${i}]`)),
    boot: str(n.boot, "napping.boot"),
    placeholder: str(n.placeholder, "napping.placeholder"),
    footer: str(n.footer, "napping.footer"),
    commands: arr(n.commands, "napping.commands").map((v, i) => {
      const o = obj(v, `napping.commands[${i}]`);
      return { cmd: str(o.cmd, `napping.commands[${i}].cmd`), blurb: str(o.blurb, `napping.commands[${i}].blurb`) };
    }),
    calls: Object.fromEntries(Object.entries(obj(n.calls, "napping.calls")).map(([k, v]) => [k, str(v, `napping.calls.${k}`)])),
    deflect: {
      maxWords: num(nd.maxWords, "napping.deflect.maxWords"),
      maxChars: num(nd.maxChars, "napping.deflect.maxChars"),
      long: str(nd.long, "napping.deflect.long"),
      auth: str(nd.auth, "napping.deflect.auth"),
      unknown: str(nd.unknown, "napping.deflect.unknown"),
      offtopic: str(nd.offtopic, "napping.deflect.offtopic"),
      injection: str(nd.injection, "napping.deflect.injection"),
      about: str(nd.about, "napping.deflect.about"),
      greeting: str(nd.greeting, "napping.deflect.greeting"),
      humanCall: str(nd.humanCall, "napping.deflect.humanCall"),
      humanEscape: str(nd.humanEscape, "napping.deflect.humanEscape"),
      unsureBelow: num(nd.unsureBelow, "napping.deflect.unsureBelow"),
      escapeOdds: num(nd.escapeOdds, "napping.deflect.escapeOdds"),
    },
    groups: arr(n.groups, "napping.groups").map((v, i) => {
      const o = obj(v, `napping.groups[${i}]`);
      return { cmd: str(o.cmd, `napping.groups[${i}].cmd`), lane: str(o.lane, `napping.groups[${i}].lane`) };
    }),
    repoBase: str(n.repoBase, "napping.repoBase"),
    effort: (() => {
      const e = obj(n.effort, "napping.effort");
      const ends = obj(e.ends, "napping.effort.ends");
      const s = (k: string) => str(e[k], `napping.effort.${k}`);
      const labels = arr(e.labels, "napping.effort.labels").map((v, i) => str(v, `napping.effort.labels[${i}]`));
      if (!labels.includes("lazy")) throw new Error("content.json: napping.effort.labels must include lazy, which every choice slides back to");
      return {
        word: s("word"), ends: { start: str(ends.start, "napping.effort.ends.start"), end: str(ends.end, "napping.effort.ends.end") },
        labels, toggleWord: s("toggleWord"), toggleNote: s("toggleNote"), toggleHint: s("toggleHint"), help: s("help"),
        call: s("call"), reply: s("reply"), replyLazy: s("replyLazy"), cancel: s("cancel"), loadBearing: s("loadBearing"),
      };
    })(),
  };
  if (!napping.commands.some((x) => x.cmd === napping.boot)) {
    throw new Error("content.json: napping.boot must be one of napping.commands, or the screen opens on nothing");
  }

  const privacy: Section[] = arr(c.privacy, "privacy").map((v, i) => {
    const o = obj(v, `privacy[${i}]`);
    const lines = arr(o.lines, `privacy[${i}].lines`);
    return {
      heading: str(o.heading, `privacy[${i}].heading`),
      // A blank line is a paragraph break and is the one empty string allowed here.
      lines: lines.map((x, j) => {
        if (typeof x !== "string") throw new Error(`content.json: privacy[${i}].lines[${j}] must be a string`);
        return x;
      }),
    };
  });

  const ct = obj(c.contact, "contact");
  const contact: ContactContent = {
    links: arr(ct.links, "contact.links").map((v, i) => {
      const o = obj(v, `contact.links[${i}]`);
      const href = str(o.href, `contact.links[${i}].href`);
      if (!href.startsWith("https://")) throw new Error(`content.json: contact.links[${i}].href must be https`);
      return { label: str(o.label, `contact.links[${i}].label`), href };
    }),
    note: arr(ct.note, "contact.note").map((v, i) => str(v, `contact.note[${i}]`)),
  };

  const out: Content = {
    handle: str(c.handle, "handle"),
    login: str(c.login, "login"),
    version: str(c.version, "version"),
    prompt: { user: str(prompt.user, "prompt.user"), host: str(prompt.host, "prompt.host") },
    panel: { uptime: str(panel.uptime, "panel.uptime") },
    boot,
    lastLogin: str(c.lastLogin, "lastLogin"),
    hint: str(c.hint, "hint"),
    back: str(c.back, "back"),
    screens,
    notFound: str(c.notFound, "notFound"),
    sudo,
    resume,
    emptyDir: str(c.emptyDir, "emptyDir"),
    filesHelp: (() => { const o = obj(c.filesHelp, "filesHelp"); return { cmd: str(o.cmd, "filesHelp.cmd"), blurb: str(o.blurb, "filesHelp.blurb") }; })(),
    napping,
    privacy,
    contact,
  };
  assertNoForbiddenNames(JSON.stringify(out), "content.json");
  return out;
}

export const loadContent = (path: URL = DEFAULT_PATH): Content =>
  validateContent(JSON.parse(readFileSync(path, "utf8")));
