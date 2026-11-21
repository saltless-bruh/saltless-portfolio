import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { build as bundle } from "esbuild";
import { loadContent, assertRowsCarryNoForbiddenNames, type Content } from "./content.ts";
import { assertFits, charsUsed } from "./rows.ts";
import type { Row } from "./rows.ts";
import { assertCovered, subsetToBase64, FORBIDDEN_GLYPHS, fontCoverage } from "./font.ts";
import { readOps } from "./ops.ts";
import { renderDoc } from "./reader.ts";
import { copyFileSync } from "node:fs";
import { shellRows } from "./shell.ts";
import { COLS_NARROW } from "./grid.ts";
import { motdRows } from "./motd.ts";
import { promptRows } from "./shell.ts";
import { readerHtml, shellHtml, screenHtml, nappingHtml, notFoundHtml } from "./html.ts";
import { resumeRows, privacyRows, contactRows, nappingCfg } from "./screens.ts";
import { nappingRows, statusRight, workingRuns, SPINNER } from "./napping.ts";

const OUT = new URL("../dist/", import.meta.url);

/**
 * Empties the output folder but keeps the folder, so a server pointed at it keeps working. The build
 * used to only add files: a writeup removed from ops/ for privacy kept its old page in dist/, and
 * the next deploy would have published it.
 */
export function emptyDir(dir: URL): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) rmSync(new URL(name, dir), { recursive: true, force: true });
}
const FONT = new URL("../vendor/JetBrainsMono-Regular.ttf", import.meta.url);

/**
 * Everything the page can ever display, not merely what the composed rows contain: the client
 * writes its own lines (`command not found`, the correction prompt, the scramble's noise) and a
 * character missing from the subset renders as a .notdef box at a different width, which breaks
 * the column grid rather than merely looking wrong. Printable ASCII is cheap insurance.
 */
/**
 * Every Screen must survive COLS_NARROW, and this is the half of that a stylesheet cannot enforce.
 * The last run of a row wraps, so it may be any length; every run BEFORE it is structure sitting at
 * a fixed column, and a structural run that starts past the narrow width is off-screen at 40
 * columns with no way to reach it. Found by rendering at 360px and reading the result, which is
 * also why it is a gate now.
 */
function assertNarrowSafe(rows: Row[], cols: number): void {
  for (const [i, row] of rows.entries()) {
    const runs = row.runs.filter((r) => !r.textOnly);
    for (const run of runs.slice(0, -1)) {
      const end = run.col + [...run.text].length;
      if (end > cols) {
        throw new Error(`row ${i}: structural run ${JSON.stringify(run.text)} ends at column ${end}, past the ${cols}-column floor`);
      }
    }
  }
}

/** Text the /napping client writes itself, or the page renders outside composed rows. */
const nappingClientText = (c: Content): string => {
  const n = c.napping;
  const cfg = nappingCfg(c);
  const r = statusRight(cfg);
  return [n.placeholder, n.tips, n.cwd, n.shortcutsHint, n.exitConfirm, n.interrupted, r.text, r.wide,
    ...n.shortcuts.flatMap((x) => [x.keys, x.what]), ...n.commands.flatMap((x) => [x.cmd, x.blurb]),
    ...workingRuns("x", 0, 0, cfg.effort.labels.join("")).map((r) => r.text), "0123456789m", n.talkDone, n.groupHint, n.interruptHint,
    ...Object.values(cfg.talks).flatMap((t) => [t.lead, t.source, t.html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;|&#\d+;/g, "")]), ...SPINNER].join("");
};

const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i)).join("");

export type BuildResult = { html: string; bytes: number; scriptBytes: number; glyphs: number; fontBytes: number };

/**
 * The generator. Emits one real HTML file per Screen plus one bundled client script; the browser
 * cannot run `.ts`, which is the whole reason a bundler is in this repo and is not in the
 * profile's (ADR 0001, retiring the profile ADR 0003 consequence).
 */
export async function build(content?: Content): Promise<BuildResult> {
  const c = content ?? loadContent();

  // Every row of the composed screen, checked before anything is written: `assertFits` catches two
  // runs colliding on one row, which is the failure a column-positioned layout actually has.
  const screens = {
    resume: resumeRows(c), privacy: privacyRows(c),
    contact: contactRows(c), napping: nappingRows(nappingCfg(c)),
  } as const;
  const all = [...shellRows(c), ...screens.resume, ...screens.privacy, ...screens.contact, ...screens.napping];
  assertFits(all);
  assertNarrowSafe(all, COLS_NARROW);
  assertRowsCarryNoForbiddenNames(all, "the Shell screen");

  const ttf = readFileSync(FONT);
  // The offense work, rendered. Its glyphs join the subset when the face has them; a writeup's
  // character the face lacks falls back to the system monospace instead of failing the build,
  // because writeups are the owner's prose, not the interface's own text.
  const ops = readOps(new URL("../ops/", import.meta.url));
  // Keyed by path under ops/, so two notes of one name in different folders stay distinct.
  const links = Object.fromEntries(ops.docs.map((d) => [d.path.join("/").replace(/\.md$/i, ""), d.href]));
  const assets = Object.fromEntries(ops.assets.map((a) => [a.path.join("/"), `/ops/${a.path.join("/")}`]));
  const rendered = ops.docs.map((d) => ({ d, html: renderDoc(d.src, { dir: d.dir, links, assets }) }));
  const covered = fontCoverage(ttf);
  const opsGlyphs = [...new Set(ops.docs.flatMap((d) => [...d.src]))].filter((ch) => covered.has(ch.codePointAt(0)!) && !FORBIDDEN_GLYPHS.includes(ch)).join("");
  const glyphs = [...new Set(ASCII + charsUsed(all) + c.hint + c.notFound + c.sudo.join("") + Object.values(c.napping.deflect).join("") + c.napping.verbs.join("") + nappingClientText(c))].sort().join("");
  for (const bad of FORBIDDEN_GLYPHS) {
    if (glyphs.includes(bad)) throw new Error(`the page uses ${bad}, which JetBrains Mono does not carry`);
  }
  // The gate the first build needed and did not have: a glyph the face lacks fails here, instead
  // of reaching a browser and being drawn as an empty box.
  assertCovered(ttf, glyphs);
  const font = await subsetToBase64(ttf, glyphs);
  // The reader gets its own, larger subset: a writeup's characters should not grow the font inlined
  // into `/`, the page with the tightest budget.
  const readerFont = await subsetToBase64(ttf, [...new Set(glyphs + opsGlyphs)].sort().join(""));

  const html = shellHtml(c, font, { dir: true, kids: { ops: ops.tree } });
  emptyDir(OUT);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL("index.html", OUT), html);
  // One real file per route, so `/resume` is a document and not a client-side illusion.
  for (const cmd of ["resume", "privacy", "contact"] as const) {
    mkdirSync(new URL(`${cmd}/`, OUT), { recursive: true });
    writeFileSync(new URL(`${cmd}/index.html`, OUT), screenHtml(c, font, cmd));
  }
  mkdirSync(new URL("napping/", OUT), { recursive: true });
  writeFileSync(new URL("napping/index.html", OUT), nappingHtml(c, font));
  writeFileSync(new URL("404.html", OUT), notFoundHtml(c, font));
  for (const { d, html: body } of rendered) {
    const dir = new URL(`.${d.href}/`, OUT);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL("index.html", dir), readerHtml(c, readerFont, d.title, body, ["ops", ...d.path].join("/")));
  }
  for (const a of ops.assets) {
    const to = new URL(`ops/${a.path.join("/")}`, OUT);
    mkdirSync(new URL(".", to), { recursive: true });
    copyFileSync(a.file, to);
  }

  const out = await bundle({
    entryPoints: [new URL("client/shell.ts", import.meta.url).pathname],
    bundle: true,
    splitting: true,
    format: "esm",
    target: "es2022",
    minify: true,
    sourcemap: false,
    write: false,
    outdir: OUT.pathname,
    entryNames: "app",
    chunkNames: "chunk-[hash]",
    legalComments: "none",
  });
  let script = "";
  for (const file of out.outputFiles) {
    writeFileSync(file.path, file.text);
    if (file.path.endsWith("app.js")) script = file.text;
  }

  return { html, bytes: Buffer.byteLength(html), scriptBytes: Buffer.byteLength(script), glyphs: [...glyphs].length, fontBytes: Math.round((font.length * 3) / 4) };
}

if (import.meta.main) {
  const r = await build();
  console.log(`dist/index.html  ${r.bytes} bytes`);
  console.log(`dist/app.js      ${r.scriptBytes} bytes`);
  console.log(`font subset       ${r.fontBytes} bytes woff2, ${r.glyphs} glyphs, inlined`);
}
