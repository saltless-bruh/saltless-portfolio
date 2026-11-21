import test from "node:test";
import assert from "node:assert/strict";
import { PALETTES } from "../src/tokens.ts";
import { contrastRatio, hexToLinear, inGamut, linearToOklab } from "../src/ramp.ts";
import { DARK_BANDS, bandsFor, bandedFill, measureBands, RAMP } from "../src/wordmark.ts";

const polar = (hex: string) => {
  const [, a, b] = linearToOklab(hexToLinear(hex));
  return { C: Math.hypot(a, b), h: Math.atan2(b, a) };
};

test("the dark bands are the approved mockup's, lightest leading", () => {
  assert.deepEqual([...DARK_BANDS], [RAMP.crest, RAMP.hover, RAMP.lit, RAMP.mid, RAMP.dim]);
  assert.deepEqual(bandsFor("dark"), [...DARK_BANDS]);
});

test("the light bands reproduce the dark ones' CONTRAST, which is what carries the design", () => {
  const light = bandsFor("light");
  DARK_BANDS.forEach((hex, i) => {
    const want = contrastRatio(hex, PALETTES.dark.bg);
    const got = contrastRatio(light[i]!, PALETTES.light.bg);
    assert.ok(Math.abs(got - want) < 0.1, `band ${i}: wanted ${want.toFixed(2)}:1, got ${got.toFixed(2)}:1`);
  });
});

test("hue and chroma are held: only lightness moves between the variants", () => {
  const light = bandsFor("light");
  DARK_BANDS.forEach((hex, i) => {
    const a = polar(hex);
    const b = polar(light[i]!);
    assert.ok(Math.abs(a.C - b.C) < 0.004, `band ${i} chroma moved ${(b.C - a.C).toFixed(4)}`);
    assert.ok(Math.abs(a.h - b.h) < 0.02, `band ${i} hue moved`);
  });
});

test("every band is inside sRGB, so none was silently clipped on the way to a hex", () => {
  for (const theme of ["dark", "light"] as const) {
    for (const hex of bandsFor(theme)) {
      assert.ok(inGamut(hexToLinear(hex)), `${hex} is outside sRGB`);
    }
  }
});

test("the mark opens strong and fades, in both variants", () => {
  for (const theme of ["dark", "light"] as const) {
    const m = measureBands(theme);
    assert.ok(m[0]!.contrast > 10, `${theme}: the leading band must carry the mark`);
    assert.ok(m[4]!.contrast < 2, `${theme}: the trailing band must fade`);
    for (let i = 1; i < m.length; i++) {
      assert.ok(m[i]!.contrast < m[i - 1]!.contrast, `${theme}: band ${i} does not continue the fade`);
    }
  }
});

test("the fill is banded, not blended: every colour appears at both ends of its band", () => {
  for (const theme of ["dark", "light"] as const) {
    const fill = bandedFill(theme);
    for (const hex of bandsFor(theme)) {
      assert.equal([...fill.matchAll(new RegExp(hex, "g"))].length, 2, `${hex} must repeat to cut`);
    }
    assert.match(fill, /^linear-gradient\(90deg, /, "the bands run along the mark's long axis");
  }
});
