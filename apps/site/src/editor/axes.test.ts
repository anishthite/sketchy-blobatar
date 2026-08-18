import { describe, expect, test } from "bun:test";
import { traits as reader } from "sketchy-blobatar";
import { AXES, SHAPES, TONES, bandIndex, bandValue, round3 } from "./axes";
import { blobLayout, resolved } from "./resolved";

/**
 * What is tested here is not the panel — it is the handful of constants this
 * app copied out of the library, and the arithmetic that reads values back out
 * of a resolved layout. Both are couplings to numbers that live somewhere else,
 * and both fail silently: a retuned band moves every config anyone saved, and a
 * retuned range leaves the clamp readback quietly pointing at the wrong place.
 */

const NAME = "sketchy";

describe("the bands copied out of the library", () => {
  test("every shape midpoint still selects the shape it names", () => {
    // The package pins these too, in `test/traits.test.ts`. Pinned again here
    // because it is *this* copy that the editor writes into people's code, and
    // a copy that agrees with nothing is the failure mode worth catching.
    for (const { name, at } of SHAPES) {
      expect(blobLayout(NAME, { shape: at }).shape).toBe(name);
    }
  });

  test("every tone midpoint lands in a different swatch", () => {
    // `toneAt` splits [0, 1) into six, and nothing in the package pins where.
    // Distinct head colours is the cheapest statement of "still six bands, and
    // these six positions still find them".
    const heads = TONES.map(t => blobLayout(NAME, { tone: t.at }).palette.head);
    expect(new Set(heads).size).toBe(TONES.length);
  });

  test("banded axes round-trip through their detents", () => {
    for (const axis of AXES) {
      if (!axis.bands) continue;
      for (let i = 0; i < axis.bands; i++) {
        expect(bandIndex(bandValue(i, axis.bands), axis.bands)).toBe(i);
      }
    }
  });

  test("a pinned value survives the round trip the panel puts it through", () => {
    // Pinning rounds; the library clamps. If either moved the number, the
    // snippet would state something the blobatar disagrees with.
    for (const v of [0, 0.001, 0.5, 0.999]) {
      expect(reader(NAME, true, { "eye.gap": round3(v) })("eye.gap")).toBe(v);
    }
  });
});

describe("reading the clamp back", () => {
  /*
   * The corner everyone tries first — biggest eyes, widest gap, tallest capsule
   * — on an organic body, which is where it actually bites. `fit` measures the
   * cluster against the *tightest* radius the body reaches, and a round body's
   * is its only one: on a round or boxy silhouette this same map fits with room
   * to spare, and reports nothing, which is the other half of being correct.
   */
  const extremes = {
    shape: 0.43,
    "eye.rx": 0.999,
    "eye.gap": 0.999,
    "eye.ratio": 0.999,
  };

  test("nothing is reported when the layout gave you what you asked for", () => {
    const t = reader(NAME, true, {});
    expect(resolved(blobLayout(NAME, {}), t)).toEqual({});

    // Including the extremes, on a body with room for them.
    const round = { ...extremes, shape: 0.14 };
    expect(resolved(blobLayout(NAME, round), reader(NAME, true, round))).toEqual({});
  });

  test("the biggest eyes and the widest gap come back short, and say so", () => {
    // The case ADR 0003 calls out: `fit` scales the eye cluster as a unit to
    // keep it inside the body, so both sliders stop moving near their tops.
    const t = reader(NAME, true, extremes);
    const ghosts = resolved(blobLayout(NAME, extremes), t);

    expect(ghosts["eye.rx"]).toBeLessThan(0.999);
    expect(ghosts["eye.gap"]).toBeLessThan(0.999);
    for (const v of Object.values(ghosts)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test("the reported position is the one the blobatar was actually drawn at", () => {
    // The readback is arithmetic over the library's ranges, so it can drift
    // from them. This is what notices: pinning the *resolved* position has to
    // produce the same geometry, because at that value nothing needs clamping.
    const t = reader(NAME, true, extremes);
    const ghosts = resolved(blobLayout(NAME, extremes), t);
    const settled = blobLayout(NAME, { ...extremes, ...ghosts });

    expect(settled.eyes[0]!.rx).toBeCloseTo(blobLayout(NAME, extremes).eyes[0]!.rx, 1);
  });
});
