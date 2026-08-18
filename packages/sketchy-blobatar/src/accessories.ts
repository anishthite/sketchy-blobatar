import type { Traits } from "./traits";

/** The two small hats the outlined style knows how to draw. */
export type Headwear = "beanie" | "cap";

/** Frames sit over the existing eyes; they never replace the face. */
export type Eyewear = "round" | "sunglasses";

/** Wearables attach at the base of the body rather than implying arms or a torso. */
export type Wearable = "bowtie" | "scarf";

/**
 * One accessory slot. `"auto"` lets the name pick from that slot's vocabulary;
 * `false` removes a slot inherited from a wider configuration.
 */
export type AccessoryChoice<T extends string> = T | "auto" | false;

/**
 * Optional accessories, all drawn with the blobatar's existing palette and
 * rounded outline. Omitted is intentionally empty, so upgrading never redraws
 * an existing blobatar.
 */
export interface BlobatarAccessories {
  headwear?: AccessoryChoice<Headwear>;
  eyewear?: AccessoryChoice<Eyewear>;
  wearables?: AccessoryChoice<Wearable>;
}

/** `"seeded"` asks for one deterministic signature accessory. */
export type Accessories = "seeded" | BlobatarAccessories;

/** The internal, fully resolved form the drawing style receives. */
export interface ResolvedAccessories {
  headwear?: Headwear;
  eyewear?: Eyewear;
  wearable?: Wearable;
}

const pick = <T extends string>(
  t: Traits,
  key: string,
  choice: AccessoryChoice<T> | undefined,
  options: readonly T[],
) => {
  if (!choice) return undefined;
  return choice === "auto" ? t.pick(key, options) : choice;
};

/**
 * Resolves the public choices without touching traits when accessories are
 * absent. That last property is why the default renderer remains byte-for-byte
 * unchanged, not merely visually similar.
 */
export function resolveAccessories(
  t: Traits,
  value?: Accessories,
): ResolvedAccessories | undefined {
  if (!value) return undefined;

  // More than one category at once reads as a costume pile at 32px. A seeded
  // blobatar therefore wears one signature piece. Exact configurations stay
  // exact; this only makes `seeded` a tasteful default instead of a
  // maximum-density one.
  const choices: BlobatarAccessories = value === "seeded"
    ? t.pick("accessory.set", [
        { headwear: "auto" },
        { eyewear: "auto" },
        { wearables: "auto" },
      ] as const)
    : value;

  const headwear = pick(t, "accessory.headwear", choices.headwear, ["beanie", "cap"] as const);
  const eyewear = pick(t, "accessory.eyewear", choices.eyewear, ["round", "sunglasses"] as const);
  const wearable = pick(t, "accessory.wearable", choices.wearables, ["bowtie", "scarf"] as const);

  return headwear || eyewear || wearable
    ? { headwear, eyewear, wearable }
    : undefined;
}
