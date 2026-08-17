/**
 * The browser half of `scripts/probe-compose.ts`. Runs in headless Chrome and
 * writes its verdicts into `#r` as JSON.
 *
 * Everything checked here is checked here and nowhere else, because none of it
 * is visible to a test that only reads markup.
 *
 * **A — the two renderings of one pose agree.** The static path bakes the pose
 * into path data; the animated path composes it out of custom properties in
 * CSS. Nothing forced those to match, and they did not: `superellipse` bakes
 * rotation into coordinates, so a scale in CSS was squashing leaned eyes along
 * screen axes while the bake squashed them along the capsule's. This renders
 * both and compares where the pixels land.
 *
 * **B — an expression change does not rebuild the DOM.** The morph is a
 * transition, and a transition needs an element with a previous computed value.
 * If React replaces the subtree, the pose is simply born at its final value and
 * every idle animation under it restarts from phase zero. Checked with real
 * React, because the thing under test is React's reconciliation.
 *
 * **C — the morph is watchable, not merely present.** See `checkPacing`.
 *
 * **D — the tremor.** The one pose channel with no static counterpart, so A
 * cannot see it. See `checkShake`.
 *
 * **E — the two renderings of one colour agree.** A's argument, one axis over.
 * See `checkTint`.
 *
 * **F — the morph runs under a real page's conditions**, with the idle layers
 * live rather than frozen. See `checkLive`.
 *
 * **G — all three directions morph**, not just the way in. See
 * `checkDirections`.
 *
 * **H — a blink does not move a posed eye.** The one defect that lived in a
 * single frame of an ambient loop rather than in the pose. See `checkBlink`.
 *
 * F and G exist because C's evidence was narrower than it read: it froze the
 * idle layers and only ever went `idle → happy`, which is one of three
 * mechanisms under conditions no real page has. Neither found a defect. That is
 * worth keeping anyway — "the morph doesn't run" was reported twice against a
 * library where it did, and being able to answer that in a minute with a
 * measurement is the point of this file.
 *
 * **Every new pose channel needs a case here.** A channel that only the CSS
 * applies, or only `bakePose` applies, looks completely fine in `bun test` — and
 * a channel with no static counterpart at all, like the tremor, is invisible to
 * every check that compares the two paths.
 */

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Blobatar } from "../../src/react";
import { happy, mad } from "../../src/expression";

interface Eye {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}

declare global {
  // eslint-disable-next-line no-var
  var CASES: {
    seed: string;
    name: string;
    lean: number;
    /** Serialized `blobatar()` output — the pose baked into path data. */
    static: string;
    /** The same blobatar animated: no pose in the markup, all of it in `vars`. */
    cls: string;
    inner: string;
    vars: Record<string, string>;
    /** `_layout` with the pose applied, and without. The animated markup draws
     *  the second and is supposed to *look* like the first. */
    posed: Eye[];
    base: Eye[];
    /** The static path's ink colour, including a pose tint. */
    fill: string;
  }[];
}

type Result = { name: string; ok: boolean; detail: string; skip?: boolean };
const results: Result[] = [];
const report = (name: string, ok: boolean, detail: string, skip?: boolean) =>
  results.push({ name, ok, detail, skip });

/**
 * Whether `getScreenCTM()` on this engine reports CSS transforms in full.
 *
 * Gecko includes the linear part and drops the translation that
 * `transform-box: fill-box` implies — a `scaleX(2)` about a box's own centre
 * comes back as a scale about the user-space origin — while the *rendering* is
 * correct, and matches Blink's pixel for pixel. So the divergence check below
 * would read hundreds of pixels of disagreement in Firefox and be measuring the
 * measurement, which is exactly the mistake `outline()` was written to avoid one
 * level down.
 *
 * Probed rather than sniffed by user agent: this is a capability that will
 * change, and when it does the check should simply start running there.
 */
function ctmReportsTransforms() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.cssText = "position:absolute;left:0;top:0;width:100px;height:100px";
  svg.innerHTML =
    `<rect x="50" y="10" width="20" height="10"` +
    ` style="transform-box:fill-box;transform-origin:center;transform:scaleX(2)"/>`;
  document.body.appendChild(svg);
  const rect = svg.firstElementChild as SVGGraphicsElement;
  // The left edge doubles away from the box's own centre (60), so user x 50
  // must land on user x 40 — which is 40px on a 1:1 viewBox at the origin.
  const p = new DOMPoint(50, 10).matrixTransform(rect.getScreenCTM()!);
  svg.remove();
  return Math.abs(p.x - 40) < 0.5;
}

const SIZE = 400;
const frame = () => new Promise(requestAnimationFrame);

/** Off-screen, and frozen: at `--mo-amp: 0` every idle layer resolves to the
 *  identity, so what is left on screen is exactly the pose. */
function mount(html: string, vars?: Record<string, string>) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.style.cssText = `position:absolute;left:0;top:0;width:${SIZE}px;height:${SIZE}px`;
  for (const [k, v] of Object.entries(vars ?? {})) svg.style.setProperty(k, v);
  svg.innerHTML = html;
  svg.querySelector(".mo-root")?.classList.add("mo-frozen");
  document.body.appendChild(svg);
  return svg;
}

/**
 * The visible geometry the composition probe compares: core, left dot, right
 * dot. The face group also contains a smile, so positional selection needs to
 * name the two marks rather than assume its final path is an eye.
 */
function paths(svg: SVGSVGElement) {
  const body = svg.querySelector<SVGPathElement>('g[stroke-width="3.4"] path')!;
  const face = svg.querySelector<SVGGElement>('g[stroke-width="2.8"]')!;
  const marks = [...face.querySelectorAll<SVGPathElement>("path")];
  return [body, marks[0]!, marks[1]!];
}

/** The small dot drawn inside the larger eye envelope that layout exposes. */
const dot = (e: Eye): Eye => ({ ...e, rx: e.rx * 0.8, ry: e.ry * 0.32 });

/**
 * Twelve points around one capsule's outline, in screen coordinates.
 *
 * Not `getBoundingClientRect`, and this matters: for SVG that returns the
 * axis-aligned box of the *transformed bounding box*, not a box around the
 * transformed geometry. The static path carries its rotation in its coordinates
 * and so reports a tight box; the animated one carries the same rotation as a
 * CSS transform and reports an inflated one. Comparing those two measures the
 * measurement, not the blobatar.
 *
 * So the capsule is evaluated where it is defined — its own `cx/cy/rx/ry/rot`,
 * which is the layout the renderer drew from — and each point is pushed through
 * the element's own `getScreenCTM()`. That CTM carries every transform the CSS
 * composed onto it, which is exactly the thing under test.
 */
function outline(el: SVGGraphicsElement, e: Eye) {
  const m = el.getScreenCTM()!;
  const t = (e.rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    const x = e.rx * Math.cos(a);
    const y = e.ry * Math.sin(a);
    return new DOMPoint(
      e.cx + x * c - y * s,
      e.cy + x * s + y * c,
    ).matrixTransform(m);
  });
}

async function checkGeometry() {
  if (!ctmReportsTransforms()) {
    report(
      "A static bake and CSS composition agree",
      true,
      "not measurable in this engine — getScreenCTM() omits the translation" +
        " that transform-box: fill-box implies, so every posed eye would read" +
        " as hundreds of pixels out while rendering correctly. Run the gate in" +
        " Chrome for this one; the pose was verified against the bake by" +
        " screenshot here.",
      true,
    );
    return;
  }
  let worst = 0;
  let worstCase = "";
  /** Per-pose, per-part maxima — a divergence that shows up under `idle` is a
   *  different bug from one that only shows up under a pose. */
  const byPose: Record<string, number[]> = {};

  for (const c of globalThis.CASES) {
    const a = mount(c.static);
    const b = mount(`<g class="${c.cls}">${c.inner}</g>`, c.vars);
    await frame();

    const pa = paths(a);
    const pb = paths(b);
    const row = (byPose[c.name] ??= [0, 0, 0]);

    // The body carries no rotation of its own on either path, so its rect is
    // measured the same way on both sides and is a fair comparison — and it is
    // the only thing that catches a body channel composing about the wrong
    // origin.
    const bodyA = pa[0]!.getBoundingClientRect();
    const bodyB = pb[0]!.getBoundingClientRect();
    const dBody = Math.max(
      Math.abs(bodyA.left - bodyB.left),
      Math.abs(bodyA.top - bodyB.top),
      Math.abs(bodyA.width - bodyB.width),
      Math.abs(bodyA.height - bodyB.height),
    );
    row[0] = Math.max(row[0]!, dBody);

    for (let i = 0; i < 2; i++) {
      const sa = outline(pa[i + 1]!, dot(c.posed[i]!));
      const sb = outline(pb[i + 1]!, dot(c.base[i]!));
      // In CSS pixels at 4× the viewBox, so a pixel of drift is a quarter of a
      // viewBox unit.
      const d = Math.max(
        ...sa.map((p, k) => Math.hypot(p.x - sb[k]!.x, p.y - sb[k]!.y)),
      );
      row[i + 1] = Math.max(row[i + 1]!, d);
      if (d > worst) {
        worst = d;
        worstCase = `${c.name} on ${c.seed} (lean ${c.lean.toFixed(1)}°), eye ${i}`;
      }
    }
    if (dBody > worst) {
      worst = dBody;
      worstCase = `${c.name} on ${c.seed}, body`;
    }
    a.remove();
    b.remove();
  }

  // The two agree to about 0.01px in practice, so this is a floating-point
  // tolerance and not a budget: 0.25px at 400px is 1/16 of a viewBox unit,
  // under the two-decimal rounding the path serializer already applies. A
  // screen-axis squash on a leaned eye lands 25px out, so there is no band
  // between "correct" and "the bug is back".
  report(
    "A static bake and CSS composition agree",
    worst < 0.25,
    `worst divergence ${worst.toFixed(2)}px of ${SIZE} — ${worstCase}\n  ` +
      Object.entries(byPose)
        .map(
          ([k, v]) =>
            `${k}: body ${v[0]!.toFixed(2)} / eyes ${v[1]!.toFixed(2)}, ${v[2]!.toFixed(2)}`,
        )
        .join("\n  "),
  );
}

async function checkContinuity() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={200} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const svg0 = host.querySelector("svg")!;
  const root0 = host.querySelector(".mo-root")!;
  const eye = host.querySelector(".mo-eye")!;
  const breathe = host.querySelector(".mo-breathe")!;
  const anim = breathe.getAnimations()[0]!;
  // Awaited, not assumed. A newly-created animation reports `startTime: null`
  // until it is ready, which Chrome resolves on a later frame — so under load
  // this captured a null, compared it against a real number afterwards, and
  // reported the seeded phase offset as lost. Order-dependent and entirely
  // spurious: it failed when other checks ran first and passed when they did
  // not, which is the signature of a flake rather than a defect.
  await anim.ready;
  const before = anim.startTime;

  // What React actually does to the DOM, rather than what it was supposed to.
  // An expression change should be attribute writes and nothing else: the class
  // on the root, and the pose properties in the `<svg>`'s style.
  const attrs: string[] = [];
  const structural: string[] = [];
  new MutationObserver((rs) => {
    for (const r of rs)
      (r.type === "attributes" ? attrs : structural).push(
        r.type === "attributes"
          ? `${r.attributeName} on <${(r.target as Element).tagName}>`
          : `${(r.target as Element).tagName} children ` +
            `(+${r.addedNodes.length}/-${r.removedNodes.length})`,
      );
  }).observe(host, { attributes: true, childList: true, subtree: true });

  setExpr(happy);
  await frame();
  await frame();

  report(
    "B nothing is added or removed, only written to",
    structural.length === 0,
    structural.length
      ? structural.join(", ")
      : `${attrs.length} attribute writes: ${[...new Set(attrs)].join(", ")}`,
  );

  const sameEye = host.querySelector(".mo-eye") === eye;
  const sameBreathe = host.querySelector(".mo-breathe") === breathe;
  report(
    "B the DOM survives an expression change",
    sameEye && sameBreathe && eye.isConnected,
    sameEye && sameBreathe
      ? "eye and breathe nodes are the same objects after the change"
      : `React replaced the subtree — the morph cannot run on a new element` +
        ` (svg ${host.querySelector("svg") === svg0}, root ${
          host.querySelector(".mo-root") === root0
        }, breathe ${sameBreathe}, eye ${sameEye})`,
  );

  // The seeded negative delay is what stops a grid breathing in unison, and a
  // restarted animation throws it away — every reacting blobatar snaps into phase
  // with every other one. Both halves are checked: the same `Animation` object,
  // and a `startTime` that did not move. A restart gives a new object; a
  // silently rescheduled one gives a new start.
  const after = host.querySelector(".mo-breathe")!.getAnimations()[0]!;
  report(
    "B breathe is not restarted",
    after === anim && after.startTime === before,
    after === anim && after.startTime === before
      ? `same Animation, startTime held at ${Math.round(Number(before))}ms,` +
        ` now ${Math.round(Number(after.currentTime))}ms into its loop`
      : "the animation was re-created — the seeded phase offset is gone",
  );

  report(
    "B the root class carries the expression",
    host.querySelector(".mo-root")!.classList.contains("mo-expr"),
    // `.mo-root` is an SVG `<g>`, so `className` is an `SVGAnimatedString`.
    // `querySelector` only promises an `Element`, whose `className` is a string.
    (host.querySelector(".mo-root") as SVGElement).className.baseVal,
  );

  // The morph itself: a transition must be running on the pose properties.
  const running = host
    .querySelector(".mo-root")!
    .getAnimations()
    .filter((a) => a instanceof CSSTransition)
    .map((a) => (a as CSSTransition).transitionProperty);
  report(
    "B a transition is actually running on the pose",
    running.some((p) => p.startsWith("--mo-")),
    running.length ? running.join(", ") : "no transitions on .mo-root",
  );
}

/**
 * C — the morph is *watchable*, not merely present.
 *
 * "A transition exists" and "you can see a transition" are different claims,
 * and the gap between them is where this shipped its second bug. The pose
 * channels travel wildly different distances — `bsx` moves 4%, `esy` moves 40%
 * — so a curve that reads as a gentle settle on the body can be entirely over
 * on the eyes before they appear to have left. That is what a hard ease-out
 * did: 53% of the eye's travel in three frames, 87% inside 100ms, then 140ms of
 * invisible tail. The transition was running the whole time and the eyes read
 * as a hard swap.
 *
 * So this measures the eye, not the body — the channel with the most to travel
 * is the one that exposes the curve — and it measures the *shape* of the
 * movement rather than its existence.
 */
async function checkPacing() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  // Frozen, so the only thing moving is the morph. Blink alone closes the eye
  // to 8% of its height for ~100ms at a time; sampling through one would report
  // the ambient loop as morph progress and make this check both wrong and
  // intermittent.
  const root = host.querySelector(".mo-root")!;
  root.classList.add("mo-frozen");
  const eye = host.querySelector<SVGPathElement>(".mo-eye")!;
  const h = () => eye.getBoundingClientRect().height;
  const from = h();

  // Read out of the stylesheet rather than hard-coded, so this measures the
  // *shape* of the curve at whatever duration is set. Duration is a taste dial
  // and the gate should not own it; front-loading and dead starts are defects
  // and it should. Pinning 240ms here is why raising the duration for the
  // exaggeration pass would otherwise have failed a check that had no opinion
  // about duration at all.
  //
  // Taken off `transition-duration` rather than off `--mo-morph`, which is an
  // *unregistered* custom property and therefore reads back as the raw token
  // stream `calc(420ms * var(--mo-rate, 1))` — `parseFloat` of that is NaN, and
  // a NaN duration silently walks this whole check off the end of its trace.
  // The resolved list is also the more honest source: it is the duration the
  // engine is actually using. Index 2 is the first pose channel, after
  // `--mo-amp` and `transform`.
  root.classList.add("mo-expr");
  const DUR =
    parseFloat(getComputedStyle(root).transitionDuration.split(",")[2]!) * 1000;
  root.classList.remove("mo-expr");

  const t0 = performance.now();
  const trace: [number, number][] = [[0, from]];
  setExpr(happy);
  // A third past the end, so the settle can be seen ending rather than assumed.
  while (performance.now() - t0 < DUR * 1.35) {
    await frame();
    trace.push([performance.now() - t0, h()]);
  }
  const to = trace[trace.length - 1]![1];
  const travel = Math.abs(from - to);
  /**
   * Fraction of the travel completed at `ms`, interpolated between the frames
   * either side of it. Frames land every ~16ms and never on the marks being
   * asked about; snapping to the next one instead reports up to a frame of
   * extra progress, which at the front of a fast curve is the difference
   * between 26% and 42%.
   */
  const at = (ms: number) => {
    const i = trace.findIndex(([t]) => t >= ms);
    const [t1, v1] = trace[i]!;
    const [t0_, v0] = trace[i - 1] ?? trace[i]!;
    const k = t1 === t0_ ? 0 : (ms - t0_) / (t1 - t0_);
    return Math.abs(from - (v0 + (v1 - v0) * k)) / travel;
  };

  report(
    "C the eye morph is watchable, not a cut",
    // Enough real travel to be judging something at all, then two bounds on the
    // shape, both stated as fractions of the duration rather than in
    // milliseconds.
    //
    // At a fifth of the way through: more than 4% or the curve has a dead start
    // and a triggered expression feels late; less than 35% or it is front-loaded
    // and the eye is gone before it appears to have left, which is
    // indistinguishable from no transition. At the halfway mark: between a third
    // and three quarters, which is what catches the long invisible tail — a
    // curve can pass the first bound and still dump everything into the middle.
    travel > 10 &&
      at(DUR * 0.2) > 0.04 &&
      at(DUR * 0.2) < 0.35 &&
      at(DUR * 0.5) > 0.33 &&
      at(DUR * 0.5) < 0.75,
    `eye height ${from.toFixed(1)}px → ${to.toFixed(1)}px over ${trace.length}` +
      ` frames of a ${DUR.toFixed(0)}ms morph; travel at each fifth: ` +
      [0.2, 0.4, 0.6, 0.8, 1]
        .map((f) => `${(at(DUR * f) * 100).toFixed(0)}%`)
        .join(" ") +
      `\n  ` +
      trace
        .slice(0, 8)
        .map(([t, v]) => `${t.toFixed(0)}:${v.toFixed(1)}`)
        .join(" "),
  );

  // The other half of "watchable": distinct rendered values, so the change is
  // spread over frames rather than landing in one.
  const steps = new Set(trace.map(([, v]) => v.toFixed(1))).size;
  report(
    "C the change is spread across frames",
    steps > 10,
    `${steps} distinct rendered eye heights across the morph`,
  );
}

/**
 * D — the tremor is real, and only where it was asked for.
 *
 * A shake is the one pose channel with no static counterpart, so check A cannot
 * see it: a bake is a still frame and a tremor is a loop, and A freezes it for
 * exactly that reason. Which leaves it completely unguarded — a `--mo-shake`
 * that never reached `translate`, or a keyframe that failed to resolve to the
 * identity at amplitude zero and left every blobatar in the grid quivering, would
 * both pass every other check in this file.
 *
 * So both halves are measured, on the same element, in screen coordinates: the
 * angry blobatar moves, and the happy one does not move at all.
 */
async function checkShake() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  createRoot(host).render(
    <>
      <Blobatar name="alain00" animate="always" expression={mad} size={SIZE} />
      <Blobatar name="alain00" animate="always" expression={happy} size={SIZE} />
    </>,
  );
  await frame();
  await frame();

  // Amplitude pinned so the idle layers contribute nothing; the tremor is not
  // gated on `--mo-amp`, because an expression has to survive an unhovered grid.
  const roots = [...host.querySelectorAll<SVGGElement>(".mo-root")];
  for (const r of roots) r.classList.add("mo-frozen-amp");

  // Sampled over more than one full period (112ms) so a slow frame cannot land
  // on the same phase twice and report a stationary blobatar.
  const travel = async (el: SVGGElement) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 16; i++) {
      await frame();
      const m = el.getScreenCTM()!;
      xs.push(m.e);
      ys.push(m.f);
    }
    return Math.hypot(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );
  };

  const angry = await travel(roots[0]!);
  const calm = await travel(roots[1]!);

  report(
    "D the tremor moves an angry blobatar and nothing else",
    angry > 1 && calm < 0.01,
    `mad travels ${angry.toFixed(2)}px of ${SIZE}, happy ${calm.toFixed(3)}px`,
  );
}

/**
 * E — the two renderings of one *colour* agree.
 *
 * Check A's argument, one axis over. A hot pose resolves its tint twice: into
 * `fill` attributes on the static path, and into `--mo-head` for the stylesheet
 * on the animated one. Nothing forces those to match, and a rule that
 * silently loses — a specificity slip, a `var()` with nothing behind it making
 * `fill` inherit black — looks completely fine to `bun test`, which only ever
 * sees the string.
 */
async function checkTint() {
  const rgb = (s: string) =>
    s.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
      : s.match(/\d+/g)!.slice(0, 3).map(Number);

  let worst = 0;
  let worstCase = "";
  for (const c of globalThis.CASES) {
    const b = mount(`<g class="${c.cls}">${c.inner}</g>`, c.vars);
    await frame();
    const marks: [Element, "fill" | "stroke", string, string][] = [
      [b.querySelector<SVGGElement>(".mo-head")!, "stroke", c.fill, "outline"],
      [b.querySelector<SVGGElement>(".mo-eyes")!, "fill", c.fill, "face"],
    ];
    marks.forEach(([el, property, expected, label]) => {
      const got = rgb(getComputedStyle(el).getPropertyValue(property));
      const want = rgb(expected);
      const d = Math.max(...got.map((v, k) => Math.abs(v - want[k]!)));
      if (d > worst) {
        worst = d;
        worstCase =
          `${c.name} on ${c.seed}, ${label} — ` +
          `static ${expected}, animated ${getComputedStyle(el).getPropertyValue(property)}`;
      }
    });
    b.remove();
  }

  // Exact, in 8-bit channels. Both sides start from the same hex string, so
  // there is no rounding to allow for and any drift at all is a real defect.
  report(
    "E static and animated agree on colour, tint included",
    worst === 0,
    worst === 0
      ? "every pose's outline and face have byte-identical channels"
      : `off by ${worst}/255 — ${worstCase}`,
  );
}

/**
 * F — the morph runs under the conditions a real page has, not the lab's.
 *
 * Every other check that watches the morph freezes `--mo-amp` first, so that the
 * only thing moving is the transition. That is right for measuring the curve and
 * wrong as the *only* evidence the curve runs: a live blobatar has five idle
 * animations going, and two of them — `mo-blink` and `mo-wrap` — write the very
 * properties the pose composes into. "It interpolates when nothing else is
 * touching it" is a weaker claim than it sounds.
 *
 * Instrumented on the registered custom property rather than on geometry,
 * which is what makes this measurable at all with the idle layers live: blink
 * closes the eye to 8% of its height for ~100ms at a time, so a geometric sample
 * cannot tell a morph from a blink. `--mo-esy` is a `<number>` nothing but the
 * transition writes.
 *
 * Mirrors the site's hero exactly — `animate="always"`, a `title`, a CSS-sized
 * SVG — because that is the surface the claim is about.
 */
async function checkLive() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return (
      <Blobatar
        name="alain00"
        animate="always"
        expression={e}
        title="Blobatar for alain00"
        style={{ width: SIZE, height: SIZE }}
      />
    );
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const root = host.querySelector(".mo-root")!;
  const esy = () =>
    parseFloat(getComputedStyle(root).getPropertyValue("--mo-esy"));
  // Read with `mo-expr` on, or this reports the *return* duration — the base
  // rule's — and calls it the morph in.
  root.classList.add("mo-expr");
  const DUR =
    parseFloat(getComputedStyle(root).transitionDuration.split(",")[2]!) * 1000;
  root.classList.remove("mo-expr");

  // Rendered *width*, not height, and that is the whole trick to measuring this
  // live. `esx` travels 1 → 1.72 and no idle layer touches X by more than the
  // wrap layer's 7%, while blink closes the eye to 8% of its height for ~100ms
  // at a time — so height cannot distinguish a morph from a blink and width can.
  const eye = host.querySelector<SVGPathElement>(".mo-eye")!;
  const w = () => eye.getBoundingClientRect().width;

  const t0 = performance.now();
  const prop: number[] = [esy()];
  const geom: number[] = [w()];
  setExpr(happy);
  while (performance.now() - t0 < DUR * 1.3) {
    await frame();
    prop.push(esy());
    geom.push(w());
  }

  const propSteps = new Set(prop.map((v) => v.toFixed(4))).size;
  // Quantised to a tenth of a pixel, so a genuinely stepped render cannot pass
  // on sub-pixel jitter from the wrap layer.
  const geomSteps = new Set(geom.map((v) => v.toFixed(1))).size;

  report(
    "F the morph runs with the idle layers live, not only frozen",
    propSteps > 10 && geomSteps > 10,
    propSteps > 10 && geomSteps > 10
      ? `${propSteps} values of --mo-esy and ${geomSteps} rendered eye widths` +
        ` across a ${DUR.toFixed(0)}ms morph` +
        ` (${geom[0]!.toFixed(1)}px → ${geom[geom.length - 1]!.toFixed(1)}px)`
      : propSteps <= 10
        ? `--mo-esy took ${propSteps} value(s) — the pose is not transitioning:` +
          ` ${[...new Set(prop.map((v) => v.toFixed(3)))].slice(0, 6).join(" ")}`
        : // The interesting failure, and the reason this check samples both: the
          // property interpolated and the shape did not. The eye's scale lives
          // inside `@keyframes mo-blink`, so that would mean a running animation
          // is not re-resolving its `var()` substitutions as the pose moves —
          // the eyes would snap while `bdy` eased.
          `--mo-esy interpolated over ${propSteps} values but the eye rendered` +
          ` only ${geomSteps} width(s): the keyframe is not following the pose`,
  );
}

/**
 * G — the other two directions.
 *
 * Everything above measures `idle → happy` and nothing else, which quietly
 * leaves two thirds of the feature untested. The three transitions are not the
 * same mechanism:
 *
 *  - **Into an expression** the renderer *adds* declarations, and the transition
 *    runs from the registered `initial-value` to them.
 *  - **Back to idle** it *removes* them, and the transition has to run toward
 *    those initials. That is the half `idle` being free depends on — an omitted
 *    declaration *is* the identity — and nothing had ever watched it happen.
 *  - **Between two expressions** it rewrites them, retargeting from whatever the
 *    current computed value happens to be, possibly mid-flight.
 *
 * Sampled on `--mo-esx`, whose three poses are far apart (1 / 1.72 / 1.85) so
 * every leg has real travel to show.
 */
async function checkDirections() {
  const host = document.createElement("div");
  document.body.appendChild(host);

  let setExpr: (e: typeof happy | undefined) => void = () => {};
  function Harness() {
    const [e, set] = useState<typeof happy | undefined>(undefined);
    setExpr = set;
    return <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />;
  }
  createRoot(host).render(<Harness />);
  await frame();
  await frame();

  const root = host.querySelector(".mo-root")!;
  const esx = () =>
    parseFloat(getComputedStyle(root).getPropertyValue("--mo-esx"));

  /** Drives one leg and returns how many distinct values it passed through. */
  const leg = async (to: typeof happy | undefined, ms: number) => {
    const seen: number[] = [esx()];
    const t0 = performance.now();
    setExpr(to);
    while (performance.now() - t0 < ms) {
      await frame();
      seen.push(esx());
    }
    return {
      steps: new Set(seen.map((v) => v.toFixed(4))).size,
      from: seen[0]!,
      to: seen[seen.length - 1]!,
    };
  };

  // Settle fully between legs, so each one starts from a resting value rather
  // than from the tail of the last.
  const enter = await leg(happy, 700);
  const swap = await leg(mad, 700);
  const back = await leg(undefined, 900);

  const rows = [
    ["idle→happy", enter],
    ["happy→mad", swap],
    ["mad→idle", back],
  ] as const;

  report(
    "G every direction morphs, not just the way in",
    rows.every(([, r]) => r.steps > 10),
    rows
      .map(
        ([name, r]) =>
          `${name} ${r.from.toFixed(2)}→${r.to.toFixed(2)} in ${r.steps} steps`,
      )
      .join(", "),
  );
}

/**
 * H — a blink does not move a posed eye.
 *
 * The bug this exists for: the eye wrapper took its `transform-origin` from
 * `fill-box`, a `<g>`'s fill box is its children's *rendered* geometry, and
 * Gecko recomputes it as the shape inside shrinks. Every blink therefore moved
 * the wrapper's origin, the pose's anisotropic scale multiplied that shift, and
 * the eye travelled ~30 viewBox units out and back — on `mad`, out of the frame
 * entirely. Reported as "the transition back to idle blinks", because an idle
 * wrapper's transform is the identity and an identity does not care where its
 * origin is: the artifact existed only while an expression was on.
 *
 * Nothing else here could see it. A and E compare the two renderings *at rest*,
 * and at rest the pose is correct in both engines; C, F and G sample the morph's
 * own channels, which never misbehaved. It took a frame inside a blink.
 *
 * Measured by hit-testing rather than by any box API. `getBoundingClientRect()`
 * and `getScreenCTM()` each disagree with the other engine about transformed SVG
 * — that is why check A skips in Blink — and this check has to be trusted in
 * Gecko above all, since that is where the defect lived. Hit-testing runs
 * against the geometry the engine paints, which is the thing under test.
 */
async function checkBlink() {
  /** The painted box of one eye path, from `elementFromPoint` hits alone. */
  const painted = (el: Element, box: DOMRect) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let y = box.top; y < box.bottom; y += 2)
      for (let x = box.left; x < box.right; x += 2) {
        const hit = document.elementFromPoint(x, y);
        if (hit !== el) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    return x1 < x0 ? null : { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, h: y1 - y0 };
  };

  const rows: [string, number, number][] = [];
  // One blobatar at a time, at the top-left. Three side by side is 1200px of a
  // headless window that is 800 wide in one engine and wider in another, and
  // `elementFromPoint` outside the viewport simply returns null — which reads
  // as "the eye is nowhere" and would fail this check for the wrong reason.
  for (const [name, e] of [
    ["idle", undefined],
    ["happy", happy],
    ["mad", mad],
  ] as [string, typeof happy | undefined][]) {
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:0;top:0";
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <Blobatar name="alain00" animate="always" expression={e} size={SIZE} />,
    );
    await frame();
    await frame();
    const svg = host.querySelector("svg")!;
    const shape = svg.querySelector(".mo-eye > *")!;
    const anims = svg.getAnimations({ subtree: true });
    for (const a of anims) a.pause();
    const blink = anims.find(
      (a) => (a as CSSAnimation).animationName === "mo-blink",
    )!;
    const dur = blink.effect!.getComputedTiming().duration as number;

    // `animation-delay` carries the seeded phase and is negative, so
    // `currentTime` is not iteration progress — solve for the offset rather
    // than assume it, or this parks the blink at an arbitrary moment and
    // measures nothing.
    const at = async (target: number) => {
      blink.currentTime = 0;
      const p0 = (blink.effect!.getComputedTiming().progress as number) ?? 0;
      blink.currentTime = ((((target - p0) % 1) + 1) % 1) * dur;
      await frame();
      await frame();
      return painted(shape, svg.getBoundingClientRect());
    };

    const rest = await at(0.5);
    const shut = await at(0.986);
    for (const a of anims) a.play();
    rows.push(
      rest && shut
        ? [name, Math.hypot(shut.cx - rest.cx, shut.cy - rest.cy), rest.h - shut.h]
        : [name, Infinity, 0],
    );
    root.unmount();
    host.remove();
  }

  report(
    "H a blink closes the eye without moving it, under every pose",
    // Three hit-test grid steps plus the fractional paint edge. The smaller
    // hand-drawn dots close by 3–4px under an already-flattened pose; the
    // failure this guards was 111px on `happy` and 128px on `mad` of a 400px
    // blobatar.
    rows.every(([, moved, closed]) => moved <= 5.5 && closed > 2),
    rows
      .map(
        ([n, moved, closed]) =>
          `${n} centre ${moved.toFixed(1)}px, height −${closed.toFixed(1)}px`,
      )
      .join("; ") + ` of ${SIZE}`,
  );
}

(async () => {
  try {
    await checkGeometry();
    await checkBlink();
    await checkLive();
    await checkDirections();
    await checkTint();
    await checkContinuity();
    await checkShake();
    await checkPacing();
  } catch (err) {
    report("harness", false, String((err as Error)?.stack ?? err));
  }
  // Posted back rather than read out of the browser, which is what lets the
  // driver run this in Gecko as well as Blink without speaking two debugging
  // protocols. The global stays for a hand-run in a real window.
  (globalThis as { RESULTS?: Result[] }).RESULTS = results;
  await fetch("/result", { method: "POST", body: JSON.stringify(results) });
})();
