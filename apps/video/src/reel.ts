/**
 * Every number the expressions announce is cut on, and the pose interpolation
 * that makes the morph renderable at all.
 *
 * Same rule as `timeline.ts`: one continuous shot, no cuts. The blobatar that
 * opens on `idle` is the same element that ends up in the roster grid wearing
 * `sick`, because the claim is that one creature wears thirteen faces — and a
 * cut would let a viewer suspect thirteen creatures.
 */

import {
  bakePose,
  happy,
  idle,
  love,
  mad,
  poseVars,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  unsure,
  wink,
  type Expression,
  type Pose,
} from "blobatar/expression";
import { traits } from "blobatar";
import { motionVars } from "blobatar/animate";
import { FPS, HEIGHT, WIDTH } from "./timeline";

export { FPS, HEIGHT, WIDTH } from "./timeline";

/** The face the film follows. The same handle the launch film opens on. */
export const HERO = "alain00";

export type Slot = { readonly name: string; readonly e: Expression };

/** The roster that already shipped. Dim in the grid — that is the whole story. */
export const OLD: readonly Slot[] = [
  { name: "idle", e: idle },
  { name: "happy", e: happy },
  { name: "sad", e: sad },
  { name: "mad", e: mad },
];

/**
 * The nine, in the order `expression.ts` declares them.
 *
 * Declaration order, not a ranking and not a "best first" cut, because that
 * order is already the argument the module makes: the six cool poses, then the
 * three that spend colour. The reel inherits it rather than keeping a second
 * ordering here that can drift from the roster.
 */
export const NEW: readonly Slot[] = [
  { name: "surprised", e: surprised },
  { name: "wink", e: wink },
  { name: "sleepy", e: sleepy },
  { name: "smug", e: smug },
  { name: "unsure", e: unsure },
  { name: "scared", e: scared },
  { name: "love", e: love },
  { name: "shy", e: shy },
  { name: "sick", e: sick },
];

// Beat boundaries.
export const REEL_FROM = 45;
/** One pose: the morph, then the hold that lets it register as a face. */
export const SLOT = 36;
export const MORPH = 13;
export const B_GRID = REEL_FROM + SLOT * NEW.length;
export const B_CARD = B_GRID + 66;
export const END = B_CARD + 96;

/** How long the hero takes to fly into its cell and the other twelve to arrive. */
export const GRID_IN = 30;

/**
 * The channels, listed once.
 *
 * `Pose` is a flat record of numbers by construction, so a key list is all an
 * interpolator needs — and listing them here rather than reaching for
 * `Object.keys` on one endpoint means a pose that omits nothing still cannot
 * silently drop a channel the other endpoint moves.
 */
const CH = [
  "esx",
  "esy",
  "tilt",
  "edy",
  "edx",
  "esx2",
  "esy2",
  "tilt2",
  "lock",
  "heat",
  "shake",
  "bdy",
] as const satisfies readonly (keyof Pose)[];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const p = {} as Pose;
  for (const k of CH) p[k] = mix(a[k], b[k], t);
  return p;
};

/**
 * The colour slots, restated.
 *
 * `blobatar/expression` re-exports the pose vocabulary but not `Palette` — it is
 * `color.ts`'s type and the entry point deliberately does not widen its surface
 * for it. Structural typing means this one matches, and a mismatch would be a
 * compile error at the `tint` below rather than something to find in a render.
 */
type Palette = Partial<Record<"bg" | "head" | "eye", string>>;

/**
 * sRGB mixing for the cross-tint case.
 *
 * The library mixes in OKLab and this does not, which is the right trade for
 * exactly this use: `color.ts` mixes between a base colour and a *derived* pair
 * that has to keep a 4.5:1 guarantee across the whole walk, while this only
 * interpolates between two colours that already hold it, over four frames, in
 * the pastel band where the two spaces barely disagree. Reaching for the real
 * thing would mean exporting the colour module from the package for a video.
 */
const mixCh = (a: string, b: string, t: number) => {
  const n = (h: string) => parseInt(h.slice(1), 16);
  const [x, y] = [n(a), n(b)];
  const ch = (sh: number) =>
    Math.round(mix((x >> sh) & 255, (y >> sh) & 255, t));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};

const mixPal = (a: Palette, b: Palette, t: number): Palette => {
  const out: Palette = { ...a };
  for (const k of ["bg", "head", "eye"] as const) {
    const [x, y] = [a[k], b[k]];
    if (x && y) out[k] = mixCh(x, y, t);
  }
  return out;
};

/**
 * A pose part-way between two expressions, as a real `Expression`.
 *
 * **This exists because the library's own morph is a CSS transition, and a CSS
 * transition does not survive frame seeking.** `seek.css` can pause and offset
 * an infinite `@keyframes` into a fixed point in its local time; a transition
 * has no local time to seek to — it is driven by wall clock from whenever the
 * class changed, and Remotion renders each frame in a tab that never saw the
 * previous one. Left alone the reel would render nine snaps.
 *
 * So the morph is re-derived here on the pose channels, which is where the
 * library interpolates it anyway — `motion.css` transitions the same twelve
 * custom properties this lerps. The output is the same face on the same frame,
 * and it is deterministic, which the transition never was.
 */
export function morph(a: Expression, b: Expression, t: number): Expression {
  const p = lerpPose(a.p, b.p, t);

  // Two poses that tint toward *different* targets cannot cross-fade on `heat`
  // alone: heat is one number and it selects nothing, so lerping it would hold a
  // nonzero heat across the frame where the target swaps and the face would jump
  // from rose to green in a single frame. Nor can they route through zero — that
  // washes the creature back to its base colour mid-morph, twice, and reads as a
  // dropped frame rather than as a transition.
  //
  // So the two *finished* palettes are mixed instead: each endpoint's own tint
  // evaluated at its own full heat, blended on the morph's clock. Both ends are
  // exact by construction, and every intermediate is on the segment between two
  // colours the contrast guarantee already covers.
  if (a.tint && b.tint && a.tint !== b.tint) {
    return {
      p,
      vars: poseVars,
      bake: bakePose,
      tint: (pal, q) => mixPal(a.tint!(pal, { ...q, heat: a.p.heat }), b.tint!(pal, { ...q, heat: b.p.heat }), t),
    };
  }

  return { p, vars: poseVars, bake: bakePose, tint: b.tint ?? a.tint };
}

/** Which slot the reel is on at a frame, and how far into its morph. */
export const reelAt = (frame: number) => {
  const i = Math.floor((frame - REEL_FROM) / SLOT);
  const local = frame - REEL_FROM - i * SLOT;
  return { i, local };
};

/**
 * The grid, as rows.
 *
 * Four, five, four. The first row is the roster that already existed and the
 * two below it are the nine, so the shape of the announcement is legible before
 * a single label is read — and the split falls exactly where the release does.
 */
export const ROWS: readonly (readonly Slot[])[] = [
  OLD,
  NEW.slice(0, 5),
  NEW.slice(5),
];

export const CELL = 210;
const ROW_Y = [280, 490, 700];

/** Where a slot's tile sits, by name. The hero flies to its own. */
export function cellOf(name: string): { x: number; y: number } {
  for (let r = 0; r < ROWS.length; r++) {
    const row = ROWS[r]!;
    const i = row.findIndex((s) => s.name === name);
    if (i >= 0) {
      return { x: WIDTH / 2 + (i - (row.length - 1) / 2) * CELL, y: ROW_Y[r]! };
    }
  }
  throw new Error(`no cell for ${name}`);
}

/** The hero's mark during the reel: centred, high enough to clear the caption. */
export const HERO_X = WIDTH / 2;
export const HERO_Y = HEIGHT / 2 - 70;

/** The hero renders at this size always and is scaled; see `Expressions.tsx`. */
export const HERO_BLOB = 460;
export const TILE_BLOB = 132;

/**
 * The hero's seeded idle timings, read back out of the motion layer.
 *
 * `-1234ms` -> `1234`: the vars ship negated, because a positive
 * `animation-delay` postpones a loop rather than offsetting its phase. A phase
 * is the positive number.
 */
const vars = motionVars(traits(HERO));
const phaseOf = (v: string | undefined) => Math.abs(parseFloat(v ?? "0"));
const periodOf = (v: string | undefined) => parseFloat(v ?? "0");

export const BLINK = periodOf(vars["--mo-blink"]);
export const SACCADE = periodOf(vars["--mo-saccade"]);
const BLINK_PHASE = phaseOf(vars["--mo-blink-phase"]);

/** `@keyframes mo-blink` shuts the eye at 98.6% of its cycle. */
const BLINK_CLOSED = 0.986;

const ms = (frame: number) => (frame / FPS) * 1000;

/**
 * The frames where the creature is mid-move: the nine morphs and the fly into
 * the grid.
 */
const BUSY: readonly (readonly [number, number])[] = [
  ...NEW.map((_, i) => {
    const from = REEL_FROM + i * SLOT;
    return [from, from + MORPH] as const;
  }),
  [B_GRID, B_GRID + GRID_IN] as const,
];

/**
 * The clock the blink runs on: wall time minus every frame spent morphing.
 *
 * **A blink inside a morph is the one place it cannot go.** It flattens both
 * eyes for about a tenth of a second; in a hold that reads as the creature being
 * alive, which is the entire job of the idle loops. Arriving in the middle of a
 * pose change it reads as a dropped frame, because the eyes are already moving
 * and a flat pair is indistinguishable from a glitch.
 *
 * The launch film solves this by shifting the whole film until the blinks land
 * where the edit wants them. That does not work here and the arithmetic says why:
 * nine morphs of 433ms each, one every 1.2s, forbid about two thirds of the
 * timeline, and three blinks all have to miss. A scan of every offset in a blink
 * period finds exactly zero that clear.
 *
 * So the blink stops advancing instead. A blink is a loop over its own local
 * time, and `seek.css` already resolves it from a clock this file hands it —
 * feeding it a clock that pauses during a morph is a two-line change there and
 * costs nothing, because the eyes have somewhere better to be for those frames
 * anyway. Blinks still happen at the seeded rate; they just cannot happen here.
 *
 * That leaves one way to fail, which is what `solveOffset` is for: a blink that
 * is *already in progress* when the clock freezes would hold a pair of shut eyes
 * for the whole morph, which is worse than the thing being fixed.
 */
export const blinkTime = (frame: number): number => {
  let frozen = 0;
  for (const [a, b] of BUSY) frozen += Math.min(Math.max(frame - a, 0), b - a);
  return ms(frame - frozen) + TIME_OFFSET;
};

/**
 * The global time offset, in ms, added to every frame's clock.
 *
 * Solved against the frozen clock above, where the only constraint left is that
 * no blink is in flight at the instant the clock stops — the ten boundaries
 * where a morph begins. That is 8% of a blink cycle forbidden per boundary
 * rather than 67% of the timeline, and a scan finds an offset in the first
 * fraction of a period.
 *
 * Shifting the whole film in time costs nothing, for the reason `timeline.ts`
 * gives: every loop is phase-seeded, so a shifted film is the same film.
 */
function solveOffset(): number {
  // A blink is not an instant: it leads in from 97.2% of the cycle. Half a span
  // either side of the closed point, plus 100ms so it does not merely graze.
  const pad = 0.02 * BLINK + 100;

  // Where the clock stands when it freezes, in its own time. Independent of the
  // offset, which is added after — so this is computed once and shifted.
  const stops = BUSY.map(([a]) => {
    let frozen = 0;
    for (const [x, y] of BUSY) frozen += Math.min(Math.max(a - x, 0), y - x);
    return ms(a - frozen);
  });

  const clear = (offset: number) =>
    stops.every((t) => {
      const local = t + offset + BLINK_PHASE;
      const into = ((local % BLINK) + BLINK) % BLINK;
      return Math.abs(into - BLINK_CLOSED * BLINK) > pad;
    });

  for (let offset = 0; offset < BLINK; offset += 20) if (clear(offset)) return offset;
  return 0;
}

export const TIME_OFFSET = solveOffset();

/**
 * Per-tile phase, so the roster does not blink as one.
 *
 * Every tile is the same name — that is the claim the grid is making, one
 * creature wearing thirteen faces — and a name is what seeds the idle loops. So
 * the thirteen breathe, bob and blink in exact unison, which is the failure
 * `motionVars` exists to prevent in a crowd, arriving here through the front
 * door. Thirteen creatures blinking on the same frame is a strobe, not a grid.
 *
 * Overriding the phases rather than the seed keeps the claim true: same shape,
 * same colour, same face, different moment. Golden-ratio spacing rather than
 * `i / 13` because the tiles are read in rows and an even spread lays a visible
 * diagonal of blinks across them. From `i + 1`, so no tile draws a zero shift
 * and sits back in unison with the one loop this cannot reach.
 *
 * The hero is not in this — it keeps the solved offset it has worn since the
 * first frame, because it is the one tile the viewer has been watching.
 */
export const tilePhase = (i: number): Record<string, string> => {
  const frac = ((i + 1) * 0.6180339887) % 1;
  return {
    "--mo-blink-phase": `${-Math.round(frac * BLINK)}ms`,
    "--mo-saccade-phase": `${-Math.round(frac * SACCADE)}ms`,
    "--mo-phase": `${-Math.round(frac * 2800)}ms`,
    "--mo-bob-phase": `${-Math.round(((frac + 0.37) % 1) * 3400)}ms`,
  };
};

/** Kept honest: the reel has to end on the pose the hero's cell is drawn for. */
if (NEW[NEW.length - 1]!.name !== "sick") {
  throw new Error("the hero lands in the wrong cell");
}

/**
 * And the grid has to be the roster — every slot placed once, nothing invented.
 *
 * `ROWS` is written as slices, so today this cannot fail. It is here for the day
 * someone re-shapes the rows by hand to fit a tenth pose: a slot dropped out of
 * the grid is a tile that silently never renders, and a slot listed twice is a
 * `cellOf` that returns the first match and stacks two blobatars on one point.
 * Both look like layout bugs and neither points at the list that caused them.
 */
{
  const placed = ROWS.flat();
  const roster = [...OLD, ...NEW];
  if (placed.length !== roster.length || roster.some((s) => !placed.includes(s))) {
    throw new Error("the grid is not the roster");
  }
}
