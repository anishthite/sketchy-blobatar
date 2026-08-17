/**
 * The regular primitive.
 *
 * |x/a|^n + |y/b|^n = 1 covers the whole part vocabulary: n=2 is an ellipse
 * (eyes), n≈4 a squircle (head, background), n→large a rectangle
 * (brows, mouth lines). Hand-drawn contours use `blobPath` below; the regular
 * form still keeps symmetric features compact and continuously configurable.
 */

export interface Superellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Squareness. Useful range is roughly 1.6 (soft diamond) to 8 (near-rect). */
  n?: number;
  /** Degrees, clockwise. Baked into the coordinates so the SVG needs no transform. */
  rot?: number;
}

const r2 = (v: number) => {
  const s = Math.round(v * 100) / 100;
  return Object.is(s, -0) ? "0" : String(s);
};

// The hand-drawn contours do not need typographic-curve precision. One decimal
// is well below a screen pixel at normal avatar sizes and keeps an inline SVG
// from paying for invisible digits on every wobble point.
const r1 = (v: number) => {
  const s = Math.round(v * 10) / 10;
  return Object.is(s, -0) ? "0" : String(s);
};

/**
 * Approximates each quadrant with one cubic Bézier.
 *
 * The control offset is chosen so the curve passes exactly through the
 * superellipse's 45° point: B(0.5) = a(4+3k)/8 must equal a·2^(-1/n).
 * At n=2 this yields 0.5523 — the standard circle constant — which is a good
 * sign the derivation is right. Four segments instead of a 24-point sampled
 * polyline keeps each shape at ~130 bytes of path data.
 */
export function superellipse({ cx, cy, rx, ry, n = 4, rot = 0 }: Superellipse): string {
  // Above n≈5.55 the control offset exceeds the radius, and the curve bulges
  // outside the bounding box instead of squaring off — an inflated-looking
  // corner rather than a sharper one. Clamping k trades exactness at the 45°
  // point for a shape that always stays within its stated bounds; past that
  // point a superellipse is visually a rounded rect anyway.
  const k = Math.min(1, (8 * Math.pow(2, -1 / n) - 4) / 3);
  const a = rx;
  const b = ry;
  const ak = a * k;
  const bk = b * k;

  // Anchor, control, control — walking the four quadrants.
  const pts: [number, number][] = [
    [a, 0],
    [a, bk], [ak, b], [0, b],
    [-ak, b], [-a, bk], [-a, 0],
    [-a, -bk], [-ak, -b], [0, -b],
    [ak, -b], [a, -bk], [a, 0],
  ];

  const t = (rot * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const at = (i: number) => {
    const [x, y] = pts[i]!;
    return `${r2(cx + x * cos - y * sin)} ${r2(cy + x * sin + y * cos)}`;
  };

  let d = `M${at(0)}`;
  for (let i = 1; i < 13; i += 3) d += `C${at(i)} ${at(i + 1)} ${at(i + 2)}`;
  return d + "Z";
}

/**
 * A quadratic arc, stroked — used only for smiles and frowns, where a closed
 * superellipse would need a boolean subtraction to get the same read. `lean`
 * lets a smile sit a little off-centre instead of looking machine-perfect.
 */
export function arc(cx: number, cy: number, w: number, depth: number, lean = 0): string {
  return `M${r2(cx - w)} ${r2(cy)}Q${r2(cx + lean)} ${r2(cy + depth)} ${r2(cx + w)} ${r2(cy)}`;
}

/**
 * An organic closed curve: radii sampled around a circle, joined by a closed
 * Catmull-Rom spline converted to cubic Béziers.
 *
 * The superellipse handles everything symmetric; this handles everything that
 * needs to look hand-drawn. `radii` are multipliers of the base radius, one per
 * vertex, so a seed perturbing them by ±15% produces the lopsided pebble shapes
 * without any noise function — the vertex count alone controls how lumpy it is.
 *
 * Catmull-Rom rather than a Bézier fit because it interpolates its points
 * exactly, so the radii mean what they say and containment stays predictable.
 */
export function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  radii: number[],
  rot = 0,
): string {
  const n = radii.length;
  const t0 = (rot * Math.PI) / 180;
  return spline(
    radii.map((m, i) => {
      const a = t0 + (2 * Math.PI * i) / n;
      return [cx + rx * m * Math.cos(a), cy + ry * m * Math.sin(a)] as [number, number];
    }),
  );
}

/**
 * A superellipse with an ink wobble baked into its contour.
 *
 * `superellipse()` is exact and deliberately regular; this version samples the
 * same implicit curve, moves each sample a little radially, and
 * joins them with the same smooth spline used by `blobPath`. The result keeps a
 * boxy blob recognisably boxy and a round blob recognisably round, while losing
 * the too-perfect edge a generated avatar otherwise has.
 */
export function roughSuperellipse(
  { cx, cy, rx, ry, n = 4, rot = 0 }: Superellipse,
  radii: number[],
): string {
  const turn = (rot * Math.PI) / 180;
  return spline(
    radii.map((m, i) => {
      const a = (2 * Math.PI * i) / radii.length;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // The distance from a superellipse centre at this angle. At n=2 this is
      // 1, so this naturally becomes a gently wobbly ellipse.
      const unit = Math.pow(Math.abs(cos) ** n + Math.abs(sin) ** n, -1 / n) * m;
      const x = rx * unit * cos;
      const y = ry * unit * sin;
      return [
        cx + x * Math.cos(turn) - y * Math.sin(turn),
        cy + x * Math.sin(turn) + y * Math.cos(turn),
      ] as [number, number];
    }),
  );
}

/** A closed Catmull–Rom contour through points already in viewBox coordinates. */
function spline(p: [number, number][]): string {
  const n = p.length;

  const at = (i: number) => p[((i % n) + n) % n]!;
  let d = `M${r1(at(0)[0])} ${r1(at(0)[1])}`;

  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    d +=
      `C${r1(x1 + (x2 - x0) / 6)} ${r1(y1 + (y2 - y0) / 6)}` +
      ` ${r1(x2 - (x3 - x1) / 6)} ${r1(y2 - (y3 - y1) / 6)}` +
      ` ${r1(x2)} ${r1(y2)}`;
  }

  return d + "Z";
}
