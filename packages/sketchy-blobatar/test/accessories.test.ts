import { describe, expect, test } from "bun:test";
import { blobatar, _parts } from "../src/blobatar";
import { happy } from "../src/expression";

const SEEDS = Array.from({ length: 300 }, (_, i) => `accessory-${i}`);

const choices = [
  { headwear: "beanie" },
  { headwear: "cap" },
  { eyewear: "round" },
  { eyewear: "sunglasses" },
  { wearables: "bowtie" },
  { wearables: "scarf" },
] as const;

describe("accessories", () => {
  test("are opt-in, including an explicitly empty configuration", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(blobatar(seed, { accessories: {} })).toBe(blobatar(seed));
      expect(
        blobatar(seed, {
          accessories: { headwear: false, eyewear: false, wearables: false },
        }),
      ).toBe(blobatar(seed));
    }
  });

  test("every named item renders as rounded outline art", () => {
    for (const accessories of choices) {
      const svg = blobatar("alain", { accessories });
      expect(svg).toContain('<g class="accessories">');
      expect(svg).toContain('stroke-linecap="round"');
      expect(svg).toContain('stroke-linejoin="round"');
      expect(svg).not.toContain("undefined");
      expect(svg).not.toContain("NaN");
    }
  });

  test("seeded sets are stable and name-derived", () => {
    expect(blobatar("alain", { accessories: "seeded" })).toBe(
      blobatar("alain", { accessories: "seeded" }),
    );
    expect(blobatar("alain", { accessories: "seeded" })).not.toBe(
      blobatar("bea", { accessories: "seeded" }),
    );
  });

  test("all accessory geometry stays within the frame", () => {
    for (const seed of SEEDS) {
      for (const accessories of [...choices, "seeded"] as const) {
        const svg = blobatar(seed, { accessories, background: false });
        for (const match of svg.matchAll(/ d="([^"]+)"/g)) {
          for (const value of match[1]!.match(/-?\d+\.?\d*/g)!.map(Number)) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  test("animated accessories keep their markup while an expression morphs", () => {
    const opts = { animate: "always" as const, accessories: "seeded" as const };
    const idle = _parts("alain", opts).inner;
    const posed = _parts("alain", { ...opts, expression: happy }).inner;

    expect(idle).toContain('class="mo-accessories"');
    expect(posed).toBe(idle);
  });
});
