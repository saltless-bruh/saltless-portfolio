import { Marked } from "marked";

/**
 * Markdown to the reader's HTML, at build time: `cat file.md` opens a page of this, styled in the
 * terminal theme. Readable first (the owner's rule: it is still a web page), so tables, images and
 * long lines are real HTML rather than cells on the shell's grid. Understands the Obsidian habits a
 * writeup brings with it: `> [!type] title` callouts and `[[wikilinks]]`.
 *
 * Raw HTML is NOT trusted, even though the files are the owner's own: offense writeups are full of
 * payloads, and one written in prose instead of code formatting would run on the site. So raw HTML
 * is shown as text, except a few formatting tags with no attributes, and `javascript:`/`data:`
 * links are not links.
 */
export type RenderCtx = {
  /** The document's folder under `ops/`, for resolving relative image paths. */
  dir: string[];
  /** A document's path under `ops/` without `.md` (`writeups/paper-cpu`) → its reader address. */
  links: Record<string, string>;
  /** An image's path under `ops/` (`writeups/img/shot.png`) → its address. */
  assets?: Record<string, string>;
};

/**
 * Obsidian's lookup: a target may be a bare name, a partial path or a full path. An exact path
 * wins; then the one name in the document's own folder; then the only one anywhere. Two files
 * of the same name elsewhere is ambiguous, and the answer is no link rather than a guess.
 */
function lookup(map: Record<string, string> | undefined, target: string, dir: string[]): string | undefined {
  if (!map) return undefined;
  if (map[target]) return map[target];
  const here = [...dir, target].join("/");
  if (map[here]) return map[here];
  const hits = Object.keys(map).filter((k) => k === target || k.endsWith(`/${target}`));
  return hits.length === 1 ? map[hits[0]!] : undefined;
}

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `[!type]`, an optional fold marker (`-`/`+`, which a static page has no use for), then a title that may hold inline tags. */
/** Formatting tags a writeup may use as HTML: no attributes, so nothing in them can run. */
const SAFE_TAG = /^<\/?(kbd|sub|sup|mark|br|details|summary|abbr|u|s)\s*\/?>$/i;
const UNSAFE_URL = /^\s*(javascript|data|vbscript):/i;

const CALLOUT = /^<p>\[!(\w+)\][+-]?[ \t]*(.*?)(\n|<\/p>\n?)/;

/**
 * Applies `fn` to the prose only: fenced code blocks and inline code spans pass through untouched,
 * because `[[ -f x ]]` in a bash block is a command, not a wikilink (found in review).
 */
function outsideCode(src: string, fn: (prose: string) => string): string {
  return src.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$|`[^`\n]+`)/m)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join("");
}

export function renderDoc(src: string, ctx: RenderCtx): string {
  return renderMd(outsideCode(src, (prose) => obsidian(prose, ctx)), ctx);
}

/** Obsidian's own syntax, rewritten into plain Markdown. */
function obsidian(src: string, ctx: RenderCtx): string {
  // Obsidian's image embed, `![[shot.png]]` or `![[shot.png|caption]]`, as a Markdown image. Found
  // by name anywhere in ops/ when the build knows it, else beside the document, as Obsidian would.
  const embedded = src.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (all, target: string, label?: string) => {
    const name = target.trim();
    if (!IMAGE.test(name)) return all.slice(1);
    const href = lookup(ctx.assets, name, ctx.dir) ?? name;
    // Angle brackets let the address hold spaces: Obsidian names screenshots "Pasted image ….png".
    return `![${(label ?? name).trim()}](<${href}>)`;
  });
  // A wikilink to a file that exists becomes a link; one that does not keeps its label as text.
  const linked = embedded.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
    // `[[note#heading]]` and `[[note.md]]` are the note; the reader has no heading anchors yet.
    const href = lookup(ctx.links, target.split("#")[0]!.trim().replace(/\.md$/i, ""), ctx.dir);
    const text = (label ?? target).trim();
    return href ? `[${text}](${href})` : text;
  });
  return linked;
}

function renderMd(linked: string, ctx: RenderCtx): string {
  const md = new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        const label = (lang ?? "").split(/\s+/)[0] || "text";
        return `<figure class="md-code"><figcaption>${esc(label)}</figcaption><pre><code>${esc(text)}</code></pre></figure>\n`;
      },
      blockquote({ tokens }) {
        const body = this.parser.parse(tokens);
        const m = CALLOUT.exec(body);
        if (!m) return `<blockquote>${body}</blockquote>\n`;
        const type = m[1]!.toLowerCase();
        const title = m[2]!.trim() || type;
        const rest = body.replace(CALLOUT, m[3] === "\n" ? "<p>" : "");
        return `<aside class="callout callout-${esc(type)}"><p class="callout-title">${title}</p>${rest}</aside>\n`;
      },
      html({ text }) {
        return text.split(/(<[^>]*>)/).map((part) => (SAFE_TAG.test(part) ? part : esc(part))).join("");
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (UNSAFE_URL.test(href)) return inner;
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}>${inner}</a>`;
      },
      image({ href, title, text }) {
        const raw = /^([a-z]+:|\/)/i.test(href) ? href : `/ops/${[...ctx.dir, href].join("/")}`;
        const src = /^[a-z]+:/i.test(raw) ? raw : encodeURI(decodeURI(raw));
        return `<img src="${esc(src)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""} loading="lazy">`;
      },
    },
  });
  return md.parse(linked) as string;
}
