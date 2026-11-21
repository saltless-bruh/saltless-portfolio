import { PALETTES } from "./tokens.ts";
import type { ThemeName } from "./tokens.ts";
import {
  contrastRatio, hexToLinear, inGamut, linearToHex, linearToOklab, oklabToLinear, cieLightness,
} from "./ramp.ts";
import type { Rgb } from "./ramp.ts";

/**
 * The mark's ramp, derived in oklch during the design session: omarchy's lightness profile with the
 * owner's own hue and chroma. Named as the approved mockup names them, darkest to lightest.
 */
export const RAMP = {
  bg: "#181e19", dim: "#384d3d", mid: "#5a8163",
  lit: "#81be91", hover: "#a7d2b0", crest: "#cfe7d4",
} as const;

/**
 * Five bands, lightest leading, read from the approved mockup (`preview/wordmark.html`, `.hband`).
 * Each colour repeats at both ends of its band, which is what makes the boundary a cut instead of a
 * blend; a soft ramp across half-block glyphs reads as a blur, because nothing else here is soft.
 */
export const DARK_BANDS = [RAMP.crest, RAMP.hover, RAMP.lit, RAMP.mid, RAMP.dim] as const;

const BANDS = 5;

const polar = (hex: string): { L: number; C: number; h: number } => {
  const [L, a, b] = linearToOklab(hexToLinear(hex));
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};

const at = (L: number, C: number, h: number): Rgb =>
  oklabToLinear([L, C * Math.cos(h), C * Math.sin(h)]);

/** The largest chroma at this hue and lightness that stays inside sRGB. */
function fitChroma(L: number, C: number, h: number): number {
  if (inGamut(at(L, C, h))) return C;
  let lo = 0, hi = C;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (inGamut(at(L, m, h))) lo = m; else hi = m;
  }
  return lo;
}

/**
 * The OKLab lightness at this hue and chroma whose WCAG contrast against `bg` is `target`.
 *
 * Bisection, for the same reason `ramp.ts` bisects: contrast moves monotonically with lightness but
 * through a matrix and two cube roots, so there is nothing to invert. Against a light background it
 * FALLS as lightness rises, which is the direction this search assumes.
 */
function lightnessForContrast(C: number, h: number, bg: string, target: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (contrastRatio(linearToHex(at(m, fitChroma(m, C, h), h)), bg) > target) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * The light variant's bands, DERIVED from the dark ones rather than picked.
 *
 * What is preserved is the CONTRAST PROFILE, not the lightness: the mark opens at about 10.5:1 and
 * fades to about 1.5:1 in both variants, so it reads the same way on either page. Lightness is the
 * only thing that moves, because the dark ramp was built against a dark page and its light end has
 * almost nothing to say on cream. Hue and chroma are held exactly; no band needs its chroma reduced
 * to stay in sRGB, which is asserted rather than assumed.
 */
export function bandsFor(theme: ThemeName): string[] {
  if (theme === "dark") return [...DARK_BANDS];
  const bg = PALETTES.light.bg;
  return DARK_BANDS.map((hex) => {
    const { C, h } = polar(hex);
    const want = contrastRatio(hex, PALETTES.dark.bg);
    const L = lightnessForContrast(C, h, bg, want);
    return linearToHex(at(L, fitChroma(L, C, h), h));
  });
}

export type Measured = { hex: string; cieL: number; contrast: number; chroma: number };

/** Reported in CIE L*, an independent scale from the OKLab the bands are built in. */
export function measureBands(theme: ThemeName): Measured[] {
  return bandsFor(theme).map((hex) => ({
    hex,
    cieL: cieLightness(hexToLinear(hex)),
    contrast: contrastRatio(hex, PALETTES[theme].bg),
    chroma: polar(hex).C,
  }));
}

/** Banded, not blended: each colour repeats at both ends of its band to force a hard cut. */
export function bandedFill(theme: ThemeName): string {
  const bands = bandsFor(theme);
  const step = 100 / BANDS;
  const stops = bands
    .map((c, i) => `${c} ${(i * step).toFixed(0)}%, ${c} ${((i + 1) * step).toFixed(0)}%`)
    .join(", ");
  return `linear-gradient(90deg, ${stops})`;
}
