/**
 * Expressions — `blobatar/expression`. See docs/expression-spec.md.
 *
 * An expression is a named pose the consumer sets and the library holds. It is
 * a separate axis from the idle loop in `animate.ts`: idle motion is ambient and
 * gated on hover, an expression is triggered and gated on nothing. A blobatar can
 * be sad and still breathing.
 *
 * Pose-only, by definition — every channel below moves a part the blobatar already
 * has. Nothing here adds a mark, so a `blob` grows no mouth when it is happy.
 * That ceiling is what the roster has to live inside: two capsule eyes and a
 * soft body, with no brows to carry anger the easy way.
 *
 * **Each expression is passed in, not named.** `blobatar()` never imports this
 * module; it calls through whatever object it is handed, so a consumer who
 * imports `happy` ships `happy` and one who imports nothing ships nothing. That
 * is the same indirection keeping `animate.ts` out of static bundles, and it is
 * here for the same reason: as a plain string option, expressions charged every
 * caller ~420 B for a feature most will never use.
 *
 * It is also why the exports below are plain object literals over shared
 * function references rather than calls to a `make()` factory. A top-level
 * function call is not provably side-effect-free, so every expression would
 * survive tree-shaking whether or not it was imported — the same trap already
 * documented on `_parts` in `blobatar.ts`.
 */

import { hot, mixHex, type Palette } from "./color";

/**
 * The channels a pose may touch, and nothing else.
 *
 * Petals are excluded on purpose: a sun's nine petals are silhouette, and moving
 * them independently reads as wind or as the creature coming apart. Path data is
 * excluded because interpolating it puts geometry on the main thread every frame.
 *
 * **The body deforms for nothing, so it no longer deforms.** `bsx`, `bsy` and
 * `skew` used to scale and lean the whole creature and have been removed. Three
 * things settled it. They rank fourth of five for legibility in the first place;
 * they are the only channels with no headroom, since frame containment binds at
 * roughly `bsx: 1.08` and a 3° lean puts a body outside the viewBox — so they
 * break the frame before they get loud enough to read; and in this variant the
 * silhouette *is* the identity. Six shapes, a seeded lopsidedness and a seeded
 * lean are what make a grid read as a crowd, and squashing that per-expression
 * is the one move that makes a blobatar stop looking like itself.
 *
 * `bdy` survives because it is a rigid translate. It moves the creature without
 * distorting it, which is what `happy`'s lift and `sad`'s sink actually needed.
 *
 * Units: scales are factors, `tilt` is degrees, offsets are viewBox units, and
 * `heat` and `shake` are 0–1 amounts. `tilt` and `edx` are mirrored per side.
 *
 * The `*2` channels are the **second eye's differential**, not its value: they
 * add to the shared channel on the right eye only, so an identity of 0 is a
 * symmetric face and every existing pose keeps emitting exactly what it did.
 * Expressed as deltas rather than as a second endpoint for precisely that
 * reason — a pair of endpoints would force every symmetric pose to state both.
 */
export interface Pose {
  /** Eye width, about each eye's own center. */
  esx: number;
  /** Eye height, about each eye's own center. */
  esy: number;
  /**
   * Eye tilt, mirrored per side: the left eye rotates by `-tilt`, the right by
   * `+tilt`.
   *
   * **What that reads as depends on the eye's orientation, and the sign flips
   * when it changes.** On a *portrait* capsule — the natural shape here, median
   * aspect 2.55:1 — a positive tilt leans both tops outward and brings the inner
   * edges down, which is the angry direction. Flatten the capsule past square
   * with `esy` and the same rotation raises the inner ends instead: on a
   * *landscape* bar, **negative** tilt is the angry `\ /` and positive is the
   * sad `/ \`.
   *
   * This is not a quirk of the implementation, it is what rotating a bar does,
   * and it is invisible to every test in the suite — clearance, containment and
   * the composition gate are all sign-blind. It cost a full roster of poses
   * wearing each other's brows to notice. **Look at the render.**
   */
  tilt: number;
  /** Eye pair offset, positive = down. */
  edy: number;
  /** Eye convergence, positive = apart. */
  edx: number;
  /** Extra width on the right eye only. */
  esx2: number;
  /** Extra height on the right eye only. */
  esy2: number;
  /** Extra tilt on the right eye only, before the per-side mirroring. */
  tilt2: number;
  /**
   * How much of the **seeded** eye lean the pose overrides, 0–1. At 0 the pose's
   * `tilt` adds to whatever lean the seed drew; at 1 the seeded lean is cancelled
   * and the eyes sit at exactly the angle the pose names.
   *
   * It exists because `tilt` is a *brow*, and a brow is an absolute direction.
   * `styles/blob.ts` leans each eye by up to 12° in a single seeded direction —
   * identity, and good identity, on an idle face. Added to a pose it is not
   * identity, it is noise on the one channel that carries the meaning: `mad`'s
   * `\ /` at −33° meets a +12° seed and comes out `\ \`, a pair of parallel bars
   * that read as bored rather than angry, while the seed 12° the other way gets
   * an unusually furious `mad`. The reference renders are unambiguous about which
   * of those is wanted.
   *
   * So the loud poses take their tilt absolute and the seeded lean returns intact
   * the moment the expression clears — the identity is in the idle face, not in a
   * per-seed discount on the expression. This is the same rule `esx`/`esy` already
   * follow by being factors on a shape the pose flattens nearly out of existence:
   * every blobatar wears the same strength of a given expression.
   *
   * Interpolates like every other channel, so the lean eases out over the morph
   * rather than snapping.
   */
  lock: number;
  /** How far the palette shifts toward its hot pair, 0–1. */
  heat: number;
  /** Tremor amplitude, 0–1. Held, not fired — see `@keyframes mo-shake`. */
  shake: number;
  /** Whole-creature offset, positive = down. */
  bdy: number;
}

/**
 * The identity pose, and the key list — every channel's custom property is its
 * own name prefixed, so no lookup table is needed. Iterating this is what lets
 * `poseVars` skip channels a pose leaves alone, which is why `idle` emits
 * nothing at all.
 */
const IDENT: Pose = {
  esx: 1,
  esy: 1,
  tilt: 0,
  edy: 0,
  edx: 0,
  esx2: 0,
  esy2: 0,
  tilt2: 0,
  lock: 0,
  heat: 0,
  shake: 0,
  bdy: 0,
};

/** What `bakePose` needs of a layout. Structural, so this module imports no variant. */
export interface Posable {
  eyes: { cx: number; cy: number; rx: number; ry: number; rot: number }[];
}

/**
 * A pose plus the two ways to apply it.
 *
 * The functions ride on the value rather than being imported by the renderer:
 * that is what makes the whole module reachable only from a consumer's own
 * import, and it is the difference between the core paying for expressions and
 * not.
 */
export interface Expression {
  readonly p: Pose;
  readonly vars: (p: Pose) => Record<string, string>;
  readonly bake: <L extends Posable>(l: L, p: Pose) => { l: L; wrap: string };
  /**
   * The palette this pose wears, for the poses that move it. Absent on the ones
   * that do not, which is what keeps `hot()` out of every bundle that imports
   * only cool expressions — the same indirection `vars` and `bake` use to keep
   * the whole module out of the core.
   */
  readonly tint?: (pal: Palette, p: Pose) => Palette;
}

const r3 = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * The animated path: pose as registered custom properties.
 *
 * Only channels that actually move are emitted. Every property is registered in
 * `motion.css` with its identity as `initial-value`, so an omitted declaration
 * *is* the identity — which makes `idle` free, shortens every other pose's
 * output, and means clearing an expression transitions back toward those
 * initials rather than snapping.
 *
 * The morph is therefore not implemented anywhere. It is what a transition on
 * these numbers does.
 */
export function poseVars(p: Pose): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in IDENT) {
    // `heat` is the one channel the stylesheet never sees. Colour is not
    // composed in CSS — it is resolved here and emitted as the finished
    // `--mo-head`, so a `--mo-heat` declaration would be a variable
    // that looks live and is read by nothing. See `heatTint`.
    if (k === "heat") continue;
    const v = p[k as keyof Pose];
    if (v !== IDENT[k as keyof Pose]) out["--mo-" + k] = r3(v);
  }
  return out;
}

/**
 * The palette a hot pose wears: the resolved one, mixed `heat` of the way toward
 * its hot pair.
 *
 * **The mix happens here rather than in CSS, and that is the load-bearing
 * choice.** The obvious shape — one registered `--mo-heat` and a
 * `color-mix(in oklab, …)` in the stylesheet — morphs beautifully on the way in
 * and pops on the way out: the hot endpoint is a custom property the expression
 * emits, so clearing the expression deletes it in the same frame `--mo-heat`
 * begins easing back, and the fill snaps to base while everything else takes
 * 560ms. Resolving the colour here instead means the stylesheet only ever sees a
 * finished colour, and `transition: fill` carries it symmetrically in both
 * directions for free.
 *
 * The hot pair is derived per seed rather than authored as one red, because
 * `blob` flips its eye between near-black and near-white with the body's
 * lightness and no fixed red clears 4.5:1 against both. `hot()` keeps that
 * guarantee across the whole mix, not merely at its ends; `test/color.test.ts`
 * verifies it at every hue, tone and heat.
 */
export function heatTint(pal: Palette, p: Pose): Palette {
  const [head, eye] = hot(pal.head!, pal.eye!);
  return {
    ...pal,
    head: mixHex(pal.head!, head, p.heat),
    eye: mixHex(pal.eye!, eye, p.heat),
  };
}

/**
 * The static path: eye channels baked into geometry, body channels handed back
 * as one `transform` attribute for the caller to wrap.
 *
 * Baking is exact rather than approximate, because the CSS composes in the same
 * order the geometry does. `superellipse` scales by `rx`/`ry` and *then* rotates,
 * and `.mo-eye` applies the pose scale innermost (in `@keyframes mo-blink`) and
 * the tilt outside it (in `mo-wrap`'s `rotate`). The offsets commute with both,
 * since the rotation and scale are about each eye's own center —
 * `transform-box: fill-box` on the animated side, the eye's own `cx`/`cy` here.
 *
 * The body half of that attribute used to be a three-transform chain derived
 * from the CSS — a scale about (50, 50), an offset, and a lean — and needed a
 * `translate(50 50) … translate(-50 -50)` sandwich to put the origin in the
 * right place. With the deforming channels gone it is one rigid translate, which
 * commutes with everything and needs no origin at all. The whole apparatus that
 * kept it honest, including the divergence the composition gate measured, was in
 * service of the two channels that are no longer here.
 *
 * The eye channels stay out of that attribute: baking them costs nothing, where
 * a per-eye transform would need its own origin round-trip and ~85 B per eye.
 */
export function bakePose<L extends Posable>(
  l: L,
  p: Pose,
): { l: L; wrap: string } {
  return {
    l: {
      ...l,
      eyes: l.eyes.map((e, i) => ({
        ...e,
        // `--mo-wrap`'s sign, spelled out: -1 on the left eye, +1 on the right,
        // so a positive tilt leans both tops outward and brings the inner edges
        // down. That asymmetry is the entire brow vocabulary available here.
        cx: e.cx + p.edx * (i ? 1 : -1),
        cy: e.cy + p.edy,
        // The `*2` differential lands on the right eye only, which is
        // `--mo-sel`'s job on the animated side. It is added *before* the
        // mirroring on `tilt`, matching `calc(var(--mo-t) * var(--mo-wrap))` —
        // adding it after would flip its sign on the left eye and turn a
        // one-sided brow into a symmetric one.
        rx: e.rx * (p.esx + (i ? p.esx2 : 0)),
        ry: e.ry * (p.esy + (i ? p.esy2 : 0)),
        // `lock` fades the seeded lean out rather than switching it off, which
        // is what lets it interpolate on the animated side. At 0 this is the
        // plain sum it always was.
        //
        // The animated path cannot bake it away — the lean is already in the
        // path's coordinates — so it subtracts the same amount on `.mo-eye`'s
        // `rotate` instead. Both resolve to R(tilt·wrap) · scale about the eye's
        // own centre; `probe-compose.ts` check A measures that they agree.
        rot: e.rot * (1 - p.lock) + (p.tilt + (i ? p.tilt2 : 0)) * (i ? 1 : -1),
      })),
    },
    wrap: p.bdy !== 0 ? `translate(0 ${r3(p.bdy)})` : "",
  };
}

/**
 * The roster. Frozen per major, exactly like the shape thresholds and the tone
 * set — a later expression is additive and safe, renaming one is not.
 *
 * These are the third tuning pass, and the loud one. The second pass established
 * *which* channels carry — eye height, then convergence, then vertical offset,
 * with tilt nearly free of signal on a tall capsule — and then set them
 * timidly: eyes scaled by 1.06–1.14 and squashed to 0.5–0.72. Measured against
 * the reference frames in `docs/references/`, that is roughly half the amplitude
 * a face needs to read as anything at a glance.
 *
 * The numbers below come off measurement rather than taste alone. Across 4000
 * seeds the capsule's natural aspect is 2.03 / 2.55 / 3.12 (p10 / median / p90,
 * `ry:rx`) — a *portrait* capsule — so a landscape bar needs `esx/esy` near 10,
 * not near 2. Containment was never the binding guard (worst corner reach is
 * ~0.95 of the 1.12 the test allows); fusion is, and a widened pair buys its
 * clearance back through `edx` at about 1:2. Tilt is cheap once the capsule is
 * flat, because a flat capsule sweeps sideways far less per degree — which is
 * what finally makes tilt a real brow rather than the dead channel it was.
 *
 * `sad` and `mad` are still the pair at risk and are still separated by three
 * channels disagreeing at once, never by one: `sad` is small eyes, far apart and
 * low; `mad` is wide flat bars, tilted hard into a V, over a compressed body.
 * Exaggeration makes that separation easier, not harder.
 *
 * Tune these in the tuning grid's paired mode, not in this file.
 */
export const idle: Expression = { p: IDENT, vars: poseVars, bake: bakePose };

/** Wide flat arcs riding high: the universal smiling squint, at full volume. */
export const happy: Expression = {
  p: {
    esx: 1.72,
    esy: 0.3,
    tilt: 8,
    edy: -1.5,
    edx: 1.5,
    // A touch of asymmetry, well short of a wink. The pair reads as *drawn*
    // rather than as stamped twice, which is the whole reason the channel
    // exists — see `docs/references/asymmetric.png` for the loud version.
    esx2: 0.08,
    esy2: 0.05,
    tilt2: -16,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: -2.2,
  },
  vars: poseVars,
  bake: bakePose,
};

/** Small eyes, low and drifted apart, over a body that sinks. */
export const sad: Expression = {
  p: {
    esx: 0.6,
    esy: 0.56,
    tilt: 26,
    edy: 3.6,
    edx: 1.9,
    esx2: -0.05,
    esy2: -0.07,
    tilt2: -7,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: 2.6,
  },
  vars: poseVars,
  bake: bakePose,
};

/** Heavy-lidded eyes, settled low: calm and a little hard to wake up. */
export const sleepy: Expression = {
  p: {
    esx: 1.28,
    esy: 0.3,
    tilt: 5,
    edy: 1.4,
    edx: 0.5,
    esx2: -0.12,
    esy2: -0.04,
    tilt2: 4,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: 1.5,
  },
  vars: poseVars,
  bake: bakePose,
};

/** Open, lifted eyes and a small buoyant hop. */
export const excited: Expression = {
  p: {
    esx: 1.18,
    esy: 1.14,
    tilt: 6,
    edy: -1.8,
    edx: 1.1,
    esx2: 0.1,
    esy2: 0.12,
    tilt2: -6,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: -1.8,
  },
  vars: poseVars,
  bake: bakePose,
};

/** One narrowed eye and a slanted pair that reads as a skeptical side-eye. */
export const suspicious: Expression = {
  p: {
    esx: 1.32,
    esy: 0.56,
    tilt: -16,
    edy: 0.6,
    edx: 0.7,
    esx2: -0.3,
    esy2: 0.12,
    tilt2: 13,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: 0.4,
  },
  vars: poseVars,
  bake: bakePose,
};

/** Small, lowered eyes tucked toward one another in a shy little retreat. */
export const bashful: Expression = {
  p: {
    esx: 0.88,
    esy: 0.72,
    tilt: 18,
    edy: 2.2,
    edx: -0.6,
    esx2: -0.16,
    esy2: 0.1,
    tilt2: -9,
    lock: 1,
    heat: 0,
    shake: 0,
    bdy: 1.3,
  },
  vars: poseVars,
  bake: bakePose,
};

/**
 * A hard `\ /` of flat bars over a body that compresses, leans and runs hot.
 *
 * The only pose that spends `heat` and `shake`, and the reason both channels
 * exist: `docs/references/angry-red.png` is a brow-down V on a body turned red
 * and vibrating, and two capsule eyes with no brows cannot reach that on
 * geometry alone. `esx` widens the capsules until the tilt has a bar to work on;
 * `edx` stays slightly positive because the widening already closes the inner
 * gap far more than a convergence would, and spending clearance on both fuses
 * the pair.
 */
export const mad: Expression = {
  p: {
    esx: 1.85,
    esy: 0.26,
    tilt: -33,
    edy: 0.4,
    edx: 0.6,
    esx2: 0,
    esy2: -0.03,
    tilt2: 5,
    lock: 1,
    heat: 0.62,
    shake: 0.55,
    bdy: 0.8,
  },
  vars: poseVars,
  bake: bakePose,
  tint: heatTint,
};
