/**
 * Two things the crowd shot depends on that are easy to break by editing a list
 * of names, and impossible to spot in a still.
 *
 * 1. The hero has to stay recognisable. The camera comes down onto it out of
 *    120 creatures, and if the blobatar beside it is the same silhouette in
 *    nearly the same hue, the push-in reads as "some blue one" rather than as
 *    the creature the film opened on. Neighbours are checked, not the whole
 *    grid — a twin six cells away is a nice coincidence, a twin adjacent is a
 *    continuity error.
 *
 * 2. The list has to fill the grid exactly. One name too few and `crowd()`
 *    wraps, putting the same blobatar on screen twice, which in a shot whose
 *    entire claim is "every name gets its own" is the worst possible bug.
 */

import { traits } from "sketchy-blobatar";
import { CROWD } from "../src/names";
import { COLS, HERO, HERO_COL, HERO_ROW, ROWS } from "../src/timeline";

const shapeOf = (v: number) =>
  v < 0.28
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

const read = (name: string) => {
  const t = traits(name);
  return { shape: shapeOf(t("shape")), hue: t.num("hue", 0, 360) };
};

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

let failed = false;
const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

const need = COLS * ROWS - 1;
if (CROWD.length !== need) {
  fail(`CROWD has ${CROWD.length} names, the grid needs exactly ${need}`);
} else {
  console.log(`✓ ${CROWD.length} names fill ${COLS}×${ROWS} around the hero`);
}

if (new Set(CROWD).size !== CROWD.length) fail("CROWD contains a duplicate name");

// Same cell-to-name mapping as the grid: the hero's cell is skipped.
const nameAt = (col: number, row: number) => {
  if (col === HERO_COL && row === HERO_ROW) return HERO;
  const i = row * COLS + col;
  const n = i - (row > HERO_ROW || (row === HERO_ROW && col > HERO_COL) ? 1 : 0);
  return CROWD[n % CROWD.length]!;
};

const hero = read(HERO);
console.log(`  hero ${HERO} — ${hero.shape}, hue ${Math.round(hero.hue)}`);

for (let dc = -1; dc <= 1; dc++) {
  for (let dr = -1; dr <= 1; dr++) {
    if (!dc && !dr) continue;
    const col = HERO_COL + dc;
    const row = HERO_ROW + dr;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    const name = nameAt(col, row);
    const n = read(name);
    const gap = hueGap(n.hue, hero.hue);
    if (n.shape === hero.shape && gap < 45) {
      fail(`${name} sits next to the hero as a ${n.shape} only ${Math.round(gap)}° away`);
    }
  }
}

if (!failed) console.log("✓ no neighbour is confusable with the hero");

process.exit(failed ? 1 : 0);
