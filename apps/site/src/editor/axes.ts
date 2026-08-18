/**
 * The control set.
 *
 * Deliberately not the keyspace. `test/keys.ts` lists forty-odd trait keys and
 * every one of them is configurable, but a slider per key is a settings dump —
 * the split between a complete encoding and a curated editor is the whole point
 * of ADR 0003, and this file is the curated half.
 *
 * Everything here writes exactly one key. The macro controls the spec proposes
 * — lumpiness over `body.r0`–`body.r7`, asymmetry over the four second-eye
 * traits — are not here, and their absence is a decision rather than an
 * omission: a macro has to be *read back* as well as written, so that an axis
 * coming from the name can show where it currently sits, and there is no honest
 * inverse of "eight jitters" to a single amplitude. One key per axis is what
 * makes lock, shuffle, readback and the snippet all the same mechanism.
 */

/** The six silhouettes. `shapeOf` in `styles/blob.ts` owns the thresholds. */
export type Shape = "round" | "organic" | "boxy" | "nub" | "cloud" | "sun";

/**
 * Each shape as the position in [0, 1) that selects it.
 *
 * **Copied from `packages/sketchy-blobatar/test/traits.test.ts`**, under "every shape in
 * the vocabulary is reachable by band midpoint", rather than derived from
 * `shapeOf`'s thresholds. The bands are frozen per major but their boundaries
 * are exactly where a retune would land, and a copy means that retune fails a
 * test in the package instead of silently moving every config anyone saved off
 * this page.
 */
export const SHAPES: { name: Shape; at: number }[] = [
  { name: "round", at: 0.14 },
  { name: "organic", at: 0.43 },
  { name: "boxy", at: 0.65 },
  { name: "nub", at: 0.78 },
  { name: "cloud", at: 0.885 },
  { name: "sun", at: 0.965 },
];

/**
 * The tone set, same treatment.
 *
 * `tone` reads as a *band* rather than as a number — `toneAt` in `color.ts`
 * splits [0, 1) into six swatches — so a slider would be a control with five
 * invisible detents and no way to tell you where they are. Six chips instead,
 * at the band midpoints.
 *
 * Unlike the shape bands these are not pinned by a test in the package, so
 * `editor.test.ts` asserts here that all six still resolve to distinct
 * palettes. That is the cheapest thing that fails if the tone set is retuned.
 */
export const TONES: { name: string; at: number }[] = [
  { name: "pastel", at: 0.1 },
  { name: "pale", at: 0.28 },
  { name: "mid", at: 0.49 },
  { name: "deep", at: 0.71 },
  { name: "bright", at: 0.865 },
  { name: "ink", at: 0.965 },
];

export type Group = "shape" | "body" | "eyes" | "color" | "decoration";

export interface Axis {
  /** The trait key this axis pins. Also its identity everywhere else. */
  key: string;
  label: string;
  group: Group;
  /**
   * How it is driven. `shape` and `tone` are categorical in the layout, not
   * continuous, so they get pickers; everything else is a slider.
   */
  kind: "slider" | "shape" | "tone";
  /**
   * Which silhouettes read this key at all. Absent means all six.
   *
   * `body.rot` is the trap the spec names: `layout` only reads it when the
   * shape is `boxy`, and the same is true of every decoration key for its own
   * shape. A tilt slider that does nothing on five of the six silhouettes is
   * the worst kind of control, so an axis that does not apply is not rendered
   * at all — and its group says, in a line, which silhouettes it needs. Same
   * answer for `body.rot` and for every decoration key, which is the point: one
   * rule, not two.
   */
  when?: Shape[];
  /**
   * Set when the layout reads this key through `t.int` — the number of distinct
   * values it can take. The slider then has that many detents instead of a
   * thousand, because a count with four outcomes dragged over 0.001 steps
   * spends most of its travel doing nothing.
   */
  bands?: number;
}

/**
 * In display order, which is also snippet order: the silhouette first, then
 * what it is made of, then how it is decorated. A pinned map that reads
 * top-to-bottom the way the panel does is one fewer thing to reconcile when
 * someone comes back to code they generated a month ago.
 */
export const AXES: Axis[] = [
  { key: "shape", label: "silhouette", group: "shape", kind: "shape" },

  { key: "body.r", label: "size", group: "body", kind: "slider" },
  { key: "body.ratio", label: "proportion", group: "body", kind: "slider" },
  // The same position means a different squareness per shape — `body.n` is read
  // over 3.4–6 on a boxy body and 1.9–2.5 on every other. Not inert, so not
  // disabled; just not comparable across silhouettes.
  { key: "body.n", label: "squareness", group: "body", kind: "slider" },
  { key: "body.rot", label: "tilt", group: "body", kind: "slider", when: ["boxy"] },

  { key: "eye.rx", label: "size", group: "eyes", kind: "slider" },
  { key: "eye.ratio", label: "roundness", group: "eyes", kind: "slider" },
  { key: "eye.n", label: "squareness", group: "eyes", kind: "slider" },
  { key: "eye.gap", label: "separation", group: "eyes", kind: "slider" },
  { key: "eye.lean", label: "lean", group: "eyes", kind: "slider" },
  { key: "gaze.x", label: "gaze x", group: "eyes", kind: "slider" },
  { key: "gaze.y", label: "gaze y", group: "eyes", kind: "slider" },

  { key: "tone", label: "tone", group: "color", kind: "tone" },
  { key: "hue", label: "hue", group: "color", kind: "slider" },

  { key: "sun.n", label: "petals", group: "decoration", kind: "slider", when: ["sun"], bands: 4 },
  { key: "sun.dist", label: "petal distance", group: "decoration", kind: "slider", when: ["sun"] },
  { key: "sun.r", label: "petal size", group: "decoration", kind: "slider", when: ["sun"] },
  { key: "sun.rot", label: "petal rotation", group: "decoration", kind: "slider", when: ["sun"] },

  { key: "cloud.n", label: "lobes", group: "decoration", kind: "slider", when: ["cloud"], bands: 3 },

  { key: "nub.n", label: "nubs", group: "decoration", kind: "slider", when: ["nub"], bands: 2 },
  { key: "nub.a0", label: "nub angle", group: "decoration", kind: "slider", when: ["nub"] },
  { key: "nub.r0", label: "nub size", group: "decoration", kind: "slider", when: ["nub"] },
];

/** Snippet key order. Panel order, so the two never disagree. */
export const KEY_ORDER = AXES.map(a => a.key);

/** Whether an axis applies to the silhouette currently on screen. */
export const applies = (axis: Axis, shape: Shape) =>
  !axis.when || axis.when.includes(shape);

/**
 * Three decimals, everywhere a value is pinned.
 *
 * This is the one rule that makes the page's acceptance test mechanical. The
 * snippet rounds because six decimals off a slider is noise — so if the preview
 * were driven by the unrounded value, the pasted snippet would render a
 * *slightly* different blobatar than the one that was on screen, in a way
 * nobody would ever catch by looking. Rounding at the point of pinning instead
 * means the preview and the snippet are driven by the identical number and the
 * generator's rounding is the identity.
 */
export const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** The value a banded axis takes at detent `i`. */
export const bandValue = (i: number, bands: number) => round3((i + 0.5) / bands);

/** Which detent a value sits in. The inverse of `bandValue`, for readback. */
export const bandIndex = (v: number, bands: number) =>
  Math.min(bands - 1, Math.max(0, Math.floor(v * bands)));

/** Panel order. Silhouette first — every axis under it decorates that choice. */
export const GROUPS: Group[] = ["shape", "body", "eyes", "color", "decoration"];
