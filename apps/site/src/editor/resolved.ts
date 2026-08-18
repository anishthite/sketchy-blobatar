/**
 * What the layout actually did with what you asked for.
 *
 * The one non-obvious thing on this page. `layout` runs in full over a
 * configured blobatar — every containment guarantee still applies — so asking
 * for the largest eyes *and* the widest gap makes `fit` scale the whole eye
 * cluster down to keep it inside the body. The blobatar stays correct and the
 * two sliders stop moving near their tops, which reads as a broken control
 * rather than as a limit.
 *
 * So the resolved position is read back out of `_layout` and drawn on the track
 * as a ghost. That is the difference between "this slider is broken" and "I am
 * at the edge of what fits".
 *
 * The ranges below are copied out of `styles/blob.ts`. That is a real coupling
 * and worth stating: they are frozen per major and public per ADR 0003 — a
 * stated trait position is *relative* to them — so this is duplicating a
 * constant that already cannot move within a major. If it moves anyway, the
 * ghost drifts; nothing renders wrong and nothing throws.
 */
import { _layout, type Traits } from "sketchy-blobatar";

/**
 * `_layout` returns a union across variants and `shape` discriminates it.
 * Narrowed once here rather than cast at each read — the same helper
 * `test/traits.test.ts` uses.
 */
export type BlobLayout = Extract<ReturnType<typeof _layout>, { shape: unknown }>;

export const blobLayout = (name: string, traits: Record<string, number>) =>
  _layout(name, { traits }) as BlobLayout;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The positions the eye cluster came out at, when they are not the ones asked
 * for. Empty when nothing was pulled back, which is the common case.
 *
 * Only the two axes `fit` scales are reported. It scales the cluster as a unit,
 * so eye *size* and eye *separation* are the pair that can land short; lean,
 * roundness and squareness are unaffected by it.
 */
export function resolved(l: BlobLayout, t: Traits): Record<string, number> {
  const rx = l.body.rx;
  const er = l.eyes[0]!.rx;
  // What `eye.rx` asked for, before `fit`. Recomputed rather than read back,
  // because the whole question is how far the two differ.
  const asked = (0.075 + t("eye.rx") * 0.03) * rx;
  const fit = asked > 0 ? er / asked : 1;

  // A thousandth of slack: `fit` is 1 exactly when it does not apply, and
  // floating point can leave it a hair under when it applies and does nothing.
  if (fit > 0.999) return {};

  const scale = 0.78 + t("eye.scale") * 0.46;
  const gap = (l.eyes[1]!.cx - l.eyes[0]!.cx) / 2;
  // `gap = fit * (wide + 0.03rx + clearance)`, and `wide * fit` is the eye
  // half-width that actually got drawn — so what is left is the clearance the
  // blobatar ended up with, in the same units the slider states.
  const clearance = gap - er * Math.max(1, scale) - rx * 0.03;

  return {
    "eye.rx": clamp01((er / rx - 0.075) / 0.03),
    "eye.gap": clamp01((clearance / rx - 0.1) / 0.14),
  };
}
