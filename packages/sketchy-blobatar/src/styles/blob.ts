import type { Palette } from "../color";
import type { BlobatarVariant } from "../render";
import { arc, blobPath, roughSuperellipse, superellipse } from "../shape";
import type { Traits } from "../traits";

/**
 * An outlined blob with two small eyes and a quiet smile.
 *
 * The silhouette carries the identity here, so it comes from a vocabulary of
 * six: a plain round, a tilted box, a lopsided organic pebble, a lumpy cloud, a
 * petalled sun, and a round body with a nub growing off it. The mark is line
 * art rather than a filled mascot: an irregular outline makes the avatar feel
 * drawn, while the tiny face leaves the silhouette as the thing a name owns.
 *
 * Every eye dimension is expressed as a fraction of the body radius rather than
 * in absolute units. Bodies here range from 22 to 38 units depending on how much
 * room the decoration needs, and absolute eye sizes would drift off a small sun
 * while looking lost on a large round.
 */

export type Shape = "round" | "boxy" | "organic" | "cloud" | "sun" | "nub";

/**
 * Weighted rather than uniform: rounds and pebbles are the everyday shapes, and
 * suns and clouds are the ones you want to be pleased to see. Thresholds are
 * frozen per major, exactly like a `pick` array.
 */
function shapeOf(v: number): Shape {
  return v < 0.28
    ? "round"
    : v < 0.58
      ? "organic"
      : v < 0.72
        ? "boxy"
        : v < 0.84
          ? "nub"
          : v < 0.93
            ? "cloud"
            : "sun";
}

/** How much of the frame the core body takes, leaving room for decoration. */
const CORE: Record<Shape, number> = {
  round: 1,
  boxy: 0.86,
  organic: 0.98,
  cloud: 0.78,
  sun: 0.7,
  nub: 0.88,
};

/** More wobble for an organic pebble, less for a drawn-but-still-boxy square. */
const WOBBLE: Record<Shape, number> = {
  round: 0.12,
  boxy: 0.09,
  organic: 0.16,
  cloud: 0.14,
  sun: 0.11,
  nub: 0.11,
};

export function layout(t: Traits, variant: BlobatarVariant = "outlined") {
  const shape = shapeOf(t("shape"));
  const r = t.num("body.r", 31, 38) * CORE[shape];
  const rx = r;
  const ry = r * t.num("body.ratio", 0.92, 1.08);

  const body = {
    cx: 50 + t.jitter("body.x", 1.5),
    cy: 50 + t.jitter("body.y", 1.5),
    rx,
    ry,
    n: shape === "boxy" ? t.num("body.n", 3.4, 6) : t.num("body.n", 1.9, 2.5),
    rot: shape === "boxy" ? t.num("body.rot", -20, 20) : 0,
    // The original filled version only spent these radii on organic bodies and
    // clouds, at a uniform ±16%. The outlined style gives each silhouette its
    // own contour character. Keeping both calculations keyed to the same traits
    // lets the variant change treatment, not identity.
    radii: Array.from(
      { length: t.int("body.pts", 6, 8) },
      (_, i) => 1 + t.jitter(`body.r${i}`, variant === "original" ? 0.16 : WOBBLE[shape]),
    ),
    smile: {
      x: t.jitter("body.r0", 1.1),
      y: t.jitter("body.r1", 0.9),
      // `arc` gives this same seeded offset a tiny endpoint tilt, turning a
      // perfect little smile into a stable signature squiggle.
      lean: t.jitter("body.r2", 1.35),
    },
  };

  // Where the eye pair sits as a unit. Gaze is deliberately a small effect: at
  // blobatar sizes it reads as jitter rather than as direction, and the budget it
  // used to spend is worth more in the gap below.
  const gx = t.jitter("gaze.x", 0.09) * rx;
  const gy = t.num("gaze.y", -0.2, 0.08) * ry;

  const er0 = t.num("eye.rx", 0.075, 0.105) * rx;
  const ratio = t.num("eye.ratio", 1.9, 3.2);
  // The second eye differs from the first in both overall size and in how tall
  // it is for that size, drawn separately so a pair can read as big-and-round
  // next to small-and-narrow rather than as one capsule scaled twice.
  const scale = t.num("eye.scale", 0.78, 1.24);
  const stretch = t.num("eye.stretch", 0.85, 1.18);

  // The gap is measured from the eye's own edge outward, not from the body
  // center. Drawn independently, a large eye and a small gap co-occur and
  // produce two capsules crammed together with no room left to tilt — and
  // because the lean bound below is derived from that clearance, those same
  // seeds also came out untilted. Deriving the gap fixes both at once.
  const clearance = t.num("eye.gap", 0.1, 0.24) * rx;
  // Every bound below is taken over the larger of the two eyes, since either one
  // can be the larger now.
  const wide = er0 * Math.max(1, scale);
  const tall = er0 * ratio * Math.max(1, scale * stretch);
  const gap0 = wide + rx * 0.03 + clearance;

  // Containment by construction rather than by hope. Each range is safe on its
  // own, but their simultaneous extremes are not, and a 2000-seed test only
  // samples that corner — it does not rule it out. Measuring the cluster against
  // the tightest radius the body actually reaches and scaling it as a unit makes
  // the guarantee hold across the whole space.
  const tight =
    shape === "organic" || shape === "cloud"
      ? Math.min(...body.radii) * 0.95
      : 1;
  const need = (Math.abs(gx) + gap0 + Math.hypot(wide, tall)) / rx;
  const fit = need > tight * 0.9 ? (tight * 0.9) / need : 1;

  const er = er0 * fit;
  const gap = gap0 * fit;
  const eyeRy = er * ratio;

  // Lean is bounded by that clearance rather than drawn freely. A tall capsule
  // tilted hard sweeps sideways by ry·sin(lean), and two of them meeting in the
  // middle of the face is the one failure this style cannot survive. The 12°
  // ceiling is a taste bound on top of that geometric one: past roughly that
  // much, the pair stops reading as a tilt and starts reading as a mistake.
  const MAX_LEAN = 12;
  const room = Math.max(0, Math.min(1, (clearance * fit) / (tall * fit)));
  const bound = Math.min(MAX_LEAN, (Math.asin(room) * 180) / Math.PI);
  const lean = t.num("eye.lean", -1, 1) * bound;
  // The second eye's own tilt is clamped to the same ceiling so the difference
  // between the two never pushes either past it.
  const lean2 = Math.max(
    -MAX_LEAN,
    Math.min(MAX_LEAN, lean + t.jitter("eye.lean2", 3.5)),
  );

  // Petals and lumps ride on a ring just outside the core, so they read as
  // part of the same creature rather than as satellites.
  const petals: { cx: number; cy: number; r: number; radii: number[] }[] = [];
  const petal = (cx: number, cy: number, r: number, i: number) => ({
    cx,
    cy,
    r,
    // The indexed body traits are already public and configuration-safe. Reusing
    // them makes every small lobe feel related to its body without opening a
    // second, unobservable family of "roughness" controls.
    radii: Array.from(
      { length: 4 },
      (_, j) => 1 + t.jitter(`body.r${(i + j) % 8}`, 0.12),
    ),
  });

  if (shape === "sun") {
    const count = t.int("sun.n", 6, 9);
    const dist = r * t.num("sun.dist", 1.0, 1.08);
    const pr = r * t.num("sun.r", 0.2, 0.26);
    const off = t.num("sun.rot", 0, 2 * Math.PI);
    for (let i = 0; i < count; i++) {
      const a = off + (2 * Math.PI * i) / count;
      petals.push(petal(
        body.cx + Math.cos(a) * dist,
        body.cy + Math.sin(a) * dist,
        pr,
        i,
      ));
    }
  } else if (shape === "cloud") {
    // Lobes ride the upper half only, so the silhouette stays a cloud rather
    // than a flower.
    const count = t.int("cloud.n", 4, 6);
    for (let i = 0; i < count; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / count;
      petals.push(petal(
        body.cx + Math.cos(a) * r * 0.8,
        body.cy + Math.sin(a) * r * 0.5,
        r * t.num(`cloud.r${i}`, 0.44, 0.62),
        i,
      ));
    }
  } else if (shape === "nub") {
    const count = t.int("nub.n", 1, 2);
    for (let i = 0; i < count; i++) {
      const a = t.num(`nub.a${i}`, 0, 2 * Math.PI);
      petals.push(petal(
        body.cx + Math.cos(a) * r * 0.88,
        body.cy + Math.sin(a) * r * 0.88,
        r * t.num(`nub.r${i}`, 0.24, 0.4),
        i,
      ));
    }
  }

  return {
    shape,
    body,
    petals,
    eyes: [
      {
        cx: body.cx + gx - gap,
        cy: body.cy + gy,
        rx: er,
        ry: eyeRy,
        n: t.num("eye.n", 3.5, 6),
        rot: lean,
      },
      {
        cx: body.cx + gx + gap,
        // Its sign decides which eye sits higher for this name. The difference
        // is deliberately tiny — a quirk, not a gaze direction — but remains
        // visible at avatar scale and survives every expression pose.
        cy: body.cy + gy + t.jitter("eye.dy", 0.09) * ry,
        // The far eye is slightly larger here, not smaller — it reads as
        // personality rather than as a perspective mistake.
        rx: er * scale,
        ry: eyeRy * scale * stretch,
        n: t.num("eye.n", 3.5, 6),
        rot: lean2,
      },
    ],
  };
}

export type Layout = ReturnType<typeof layout>;

/**
 * `mo` is set when animating, and absent otherwise — so the static path emits
 * byte-identical markup to what it always has.
 *
 * The nesting is not decoration. An element has one `transform` property, so
 * hover-lift, breathe and bob have to live on separate elements or they
 * overwrite each other. Eyes get their own class because blink scales each one
 * about its own center; applied to the shared group, they slide toward the
 * group center instead of closing.
 *
 * The hover-lift element — `.mo-root` — is deliberately *not* emitted here. It
 * is the one element whose class varies with the expression, and the caller
 * renders it so that variation never touches this string. See `makeParts`.
 */
export function render(
  l: Layout,
  p: Palette,
  mo?: boolean,
  variant: BlobatarVariant = "outlined",
): string {
  const b = l.body;
  const original = variant === "original";
  // Every outlined core carries some ink wobble. The original filled design
  // kept only organic bodies and clouds irregular, and retained exact circles
  // for its petals, which is the visual treatment the style switch restores.
  const core = original
    ? l.shape === "organic" || l.shape === "cloud"
      ? blobPath(b.cx, b.cy, b.rx, b.ry, b.radii, l.shape === "cloud" ? 0 : b.rot, 2)
      : superellipse(b)
    : roughSuperellipse(b, b.radii);

  const r2 = (v: number) => Math.round(v * 100) / 100;

  // `--mo-wrap` is which side of the face this eye is on: -1 left, +1 right. The
  // wrap layer needs to treat the two eyes differently — the one leading into a
  // turn foreshortens harder, and on a diagonal glance they tilt toward each
  // other rather than together — and a sign per eye lets one `@keyframes` serve
  // both. A class per side would work too and cost a selector; this costs 16
  // bytes and no ids, which the no-collision guarantee depends on.
  //
  // `--mo-lean` is this eye's own tilt, and it is not decoration either.
  // `superellipse` bakes rotation into the coordinates, so a leaned capsule
  // arrives in the DOM already tilted and its element-local axes are the
  // viewport's. A `scaleY` on it — blink's, or an expression's — would then
  // squash along screen-Y and shear the capsule instead of closing it. The
  // stylesheet counter-rotates around every such scale, and this is the angle it
  // needs. ~16 B per animated blobatar; see `@keyframes mo-blink`.
  //
  // `transform-origin` is this eye's own centre, stated in user units, and it is
  // the one per-eye value that exists to work around an engine rather than to
  // describe the blobatar. The wrapper used to take `transform-box: fill-box` and
  // `transform-origin: center` like the shape below it — but a `<g>`'s fill box
  // is its children's *rendered* geometry, and Gecko recomputes it as they move.
  // A blink shrinks the shape to ~12% of its height, the wrapper's origin
  // follows it, and the pose's anisotropic scale — 1.72 × 0.30 on `happy` —
  // turns that small shift into ~30 viewBox units of travel and back. Invisible
  // at idle, because an idle wrapper's transform is the identity and an identity
  // does not care where its origin is; loud under every expression, which is
  // what made it read as a morph bug. Measured, `mad` on Firefox: the left eye
  // left the frame entirely for the length of a blink. ~26 B per eye.
  //
  // **The animated eye is a `<g>` around the shape, not the shape itself**, and
  // the extra node is what makes the morph run in Firefox. The pose and the idle
  // loops used to share one element, which left the pose's scale and tilt with
  // nowhere to live but inside `@keyframes` — and Gecko resolves a keyframe's
  // `var()` against the transition's *endpoint*, so those two channels snapped
  // while every other one eased. The wrapper carries the pose as plain
  // declarations and the shape underneath keeps the loops. ~8 B per eye; see
  // `.mo-eye` in `motion.css` for the measurement.
  const eye = (e: Layout["eyes"][number], i: number) => {
    if (original) {
      const path = `<path d="${superellipse(e)}"/>`;
      return mo
        ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
        : path;
    }

    /*
     * The layout keeps the generous portrait eye envelope: expressions use it
     * for their scale and tilt channels, and the containment maths continues to
     * describe the full range they can sweep through. What we draw inside that
     * envelope is deliberately much rounder, so the resting face reads as two
     * ink dots instead of two heavy capsules.
     *
     * A resting eye is close to circular. The vertical factor comes from the
     * original eye height rather than from `rx`: `bakePose` and the animated
     * wrapper can then apply the same independent X/Y expression scale to the
     * dot, which keeps static and animated poses geometrically identical.
     */
    const dot = {
      ...e,
      rx: e.rx * 0.8,
      ry: e.ry * 0.32,
    };
    const ink = Array.from(
      { length: 5 },
      (_, j) => l.body.radii[(i * 3 + j) % l.body.radii.length]!,
    );
    const path = `<path d="${blobPath(dot.cx, dot.cy, dot.rx, dot.ry, ink, dot.rot)}"/>`;
    return mo
      ? `<g class="mo-eye" style="--mo-wrap:${i ? 1 : -1};--mo-lean:${r2(e.rot)};transform-origin:${r2(e.cx)}px ${r2(e.cy)}px">${path}</g>`
      : path;
  };

  const body = original
    ? `<g fill="${p.head}"${mo ? ` class="mo-original-head"` : ""}>` +
      // Decoration first so the core sits on top and the eyes always land on it.
      l.petals
        .map((d) => `<circle cx="${r2(d.cx)}" cy="${r2(d.cy)}" r="${r2(d.r)}"/>`)
        .join("") +
      `<path d="${core}"/>` +
      `</g>` +
      `<g fill="${p.eye}"${mo ? ` class="mo-eyes mo-original-eyes"` : ""}>` +
      l.eyes.map(eye).join("") +
      `</g>`
    :
    /*
     * An outline gets a real class only in animated markup. Motion needs a
     * place to transition the expression tint, but static blobatars still take
     * the compact, class-free URI path. Rounded joins stop the cloud and sun
     * from looking mechanically assembled at small avatar sizes.
     */
      `<g fill="none" stroke="${p.head}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"${mo ? ` class="mo-head"` : ""}>` +
    // Decoration first so the core sits on top. Filled art could visually union
    // overlaps; in line art that order leaves the main outline clean and lets
    // the smaller loops read as a deliberate scallop rather than a seam.
    l.petals
      .map((d) => `<path d="${blobPath(d.cx, d.cy, d.r, d.r, d.radii)}"/>`)
      .join("") +
    `<path d="${core}"/>` +
    `</g>` +
    // The facial marks take their lead from the outline, so they remain legible
    // on a dark host. The eye wrappers keep blink and glance independent, while
    // the smile stays still as an anchor instead of competing with every
    // expression.
    `<g fill="${p.head}" stroke="${p.head}" stroke-width="2.8" stroke-linecap="round"${mo ? ` class="mo-eyes"` : ""}>` +
    l.eyes.map(eye).join("") +
    `<path d="${arc(
      b.cx + b.smile.x,
      b.cy + b.ry * 0.29 + b.smile.y,
      b.rx * 0.23,
      b.ry * 0.1,
      b.smile.lean,
    )}" fill="none"/>` +
      `</g>`;

  return mo
    ? `<g class="mo-breathe"><g class="mo-bob">${body}</g></g>`
    : body;
}

/**
 * No backdrop by default. The outline is the blobatar here, and a plate behind
 * a near-full-bleed shape just adds a rim of color that fights the silhouette.
 */
export const background = false as const;
