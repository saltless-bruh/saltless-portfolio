import { readdirSync, readFileSync, statSync } from "node:fs";
import type { Node } from "./client/fs.ts";

/**
 * The repo's `ops/` folder, read at build: the offense work as files. Markdown files are the
 * documents a visitor can `ls` and `cat`; images beside them are assets the reader shows; anything
 * else is ignored. Adding a writeup is adding a file here, and nothing else.
 */
export type OpsDoc = { path: string[]; dir: string[]; href: string; title: string; src: string };
export type OpsAsset = { path: string[]; file: URL };

const ASSET = /\.(png|jpe?g|gif|webp|svg)$/i;

/** An address segment: lowercase, spaces to dashes, nothing a URL would need escaping for. */
export const slug = (name: string): string =>
  name.replace(/\.md$/i, "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");

export function readOps(root: URL): { tree: Node; docs: OpsDoc[]; assets: OpsAsset[] } {
  const docs: OpsDoc[] = [];
  const taken = new Map<string, string>();
  const assets: OpsAsset[] = [];
  const walk = (dir: URL, at: string[]): Node => {
    const kids: Record<string, Node> = {};
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith(".")) continue;
      const url = new URL(name, dir);
      if (statSync(url).isDirectory()) {
        kids[name] = walk(new URL(`${name}/`, dir), [...at, name]);
      } else if (/\.md$/i.test(name)) {
        const src = readFileSync(url, "utf8");
        const parts = [...at, name].map(slug);
        if (parts.some((p) => !p)) throw new Error(`ops/${[...at, name].join("/")} has no usable address: rename it with some ASCII letters or digits`);
        const href = `/ops/${parts.join("/")}`;
        const other = taken.get(href);
        // Two pages on one address would silently overwrite each other (found in review).
        if (other) throw new Error(`ops/${other} and ops/${[...at, name].join("/")} would share the same address ${href}: rename one`);
        taken.set(href, [...at, name].join("/"));
        // The first heading outside code, without its Markdown marks: a `# comment` in a bash block is
        // not the title, and `# **Real** \`Title\`` is "Real Title" in a browser tab.
        const prose = src.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "");
        const heading = /^#\s+(.+)$/m.exec(prose)?.[1];
        const title = heading ? heading.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim() : name.replace(/\.md$/i, "");
        docs.push({ path: [...at, name], dir: at, href, title, src });
        kids[name] = { dir: false, href };
      } else if (ASSET.test(name)) {
        assets.push({ path: [...at, name], file: url });
      }
    }
    return { dir: true, kids };
  };
  return { tree: walk(root, []), docs, assets };
}

/** The shell's file system: home, holding `ops/`. `ls` at home shows the folder, not its contents. */
export function homeTree(root: URL): Node {
  return { dir: true, kids: { ops: readOps(root).tree } };
}
