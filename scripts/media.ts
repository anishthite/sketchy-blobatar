/**
 * Renders the README's two images — `docs/media/crowd.png` and
 * `docs/media/sheet.png`.
 *
 * They make different claims and are built differently because of it. The crowd
 * is the hero: a field of blobatars from a list of names, arguing by density
 * that no two come out alike. The sheet is the legend: one cell per option, each
 * labelled with the argument that produced it. Regenerate both with
 * `bun run media` whenever the shape bands, the palette, the tone set or an
 * expression moves — a stale sheet documents a library that no longer exists,
 * and a stale crowd quietly stops being made of real output.
 *
 * Chrome only rasterizes. The SVG is composed here, laid out with plain CSS, and
 * screenshotted at 2x so the mono labels stay crisp on a retina README.
 *
 * Nothing here may call `Math.random()`. The site's wall reshuffles per visit
 * on purpose — a field that is provably different on every reload is the
 * cheapest proof of the claim — but a committed PNG has no visits, and a random
 * one would rewrite itself on every run and show up in every diff. So the crowd
 * draws from a seeded generator, and running this twice writes the same bytes.
 */

import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { blobatar } from "../packages/sketchy-blobatar/src/blobatar";
import {
  bashful,
  excited,
  happy,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  suspicious,
  unsure,
  wink,
  type Expression,
} from "../packages/sketchy-blobatar/src/expression";
import type { BlobatarOptions } from "../packages/sketchy-blobatar/src/render";

const ROOT = join(import.meta.dir, "..");
const MEDIA = join(ROOT, "docs/media");

/** Ink. The site's ground, which is a hair off black, not `#000`. */
const BG = "#0a0a0b";
const LABEL = "#8b8b8b";

/** Device pixels per CSS pixel in the shot; 2 keeps mono labels crisp. */
const SCALE = 2;

/**
 * How much shorter Chrome's viewport is than the window it was asked for — 87px
 * of frame on this build, and the reason the first cut of this script silently
 * ate the sheet's bottom row of labels. Overshoot by more than that and crop
 * back to the page's own height, so a Chrome that frames differently still
 * cannot clip.
 */
const FRAME = 160;

const mono = readFileSync(
  join(ROOT, "apps/site/fonts/geist-mono-variable.woff2"),
).toString("base64");

/** Shared chrome for both pages: the ground, the font, and a fixed page box. */
const page = (width: number, height: number, css: string, body: string) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Geist Mono";
    src: url(data:font/woff2;base64,${mono}) format("woff2");
    font-weight: 100 900;
  }
  * { margin: 0; padding: 0; box-sizing: border-box }
  html { background: ${BG} }
  body {
    background: ${BG};
    font-family: "Geist Mono", ui-monospace, monospace;
    width: ${width}px; height: ${height}px;
  }
  svg, img { display: block; width: 100%; height: 100% }
  ${css}
</style>
${body}
`;

// ---------------------------------------------------------------------------
// The crowd
// ---------------------------------------------------------------------------

const CROWD = { width: 1400, height: 520, out: join(MEDIA, "crowd.png") };

/**
 * A jittered grid, not raw coordinates.
 *
 * Pure randomness clumps — three blobatars overlapping in one corner and an
 * empty quadrant beside it — whereas one blobatar per cell, nudged off centre,
 * reads as scattered while staying evenly spread. Same reasoning as the site's
 * wall, and the same failure if you skip it.
 */
const COLS = 16;
const ROWS = 5;

/**
 * A few cells stay empty on purpose. A perfectly populated grid is still
 * legible as a grid, and the gaps are what break the last of the rhythm — kept
 * low here because the overlap test below already thins the field.
 */
const SKIP = 0.06;

/**
 * Three depth layers, far to near. The smallest carries no caption: at 38px the
 * name is wider than the creature and lands on its neighbours, and a band of
 * illegible captions is texture, not information.
 */
const DEPTHS = [
  { size: 38, label: false },
  { size: 58, label: true },
  { size: 80, label: true },
];

/** Label metrics, needed up front because they decide how far in a cell can sit. */
const CAP_GAP = 8;
const CAP_LINE = 15;

/**
 * mulberry32 — four lines, uniform enough for scatter, and above all fixed.
 * The constant is just a seed that produced a field with no two neighbours
 * reading as the same creature; change it and you are reshuffling the hero.
 */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seeds. Handles rather than `k7f2p9`: the field is claiming to be a user
 * list, and a wall of hashes proves the mathematical claim while undercutting
 * the emotional one. The site's list, kept longer than the field needs — names
 * are drawn without replacement, and the first cut ran out and started
 * repeating, which puts the same handle twice in a picture whose whole argument
 * is that nothing repeats.
 */
const NAMES = [
  "alain", "astrid", "bao", "beatriz", "bjorn", "camille", "carlos", "chidi",
  "clara", "dagny", "daniela", "dario", "diego", "dmitri", "eero", "elena",
  "elias", "elin", "emeka", "emil", "esther", "fatima", "felix", "finn",
  "freya", "gabriel", "gita", "greta", "gustav", "hana", "hassan", "heidi",
  "henrik", "hugo", "ida", "ines", "ingrid", "isabel", "ivan", "jae",
  "jonas", "julia", "kai", "kaisa", "karim", "kasper", "katya", "keiko",
  "kenji", "kira", "klara", "kofi", "lars", "laura", "leena", "leif",
  "lena", "leo", "liam", "lila", "linnea", "lotta", "luca", "lucia",
  "ludvig", "magnus", "maja", "malin", "manon", "marco", "maren", "maria",
  "marta", "mateo", "mattias", "mei", "mikael", "milena", "mira", "nadia",
  "naoki", "nils", "nina", "noor", "nora", "olav", "olga", "oskar",
  "otto", "paavo", "pablo", "paloma", "petra", "pia", "priya", "rafael",
  "raisa", "rasmus", "rebecca", "ren", "rikke", "rosa", "ruben", "runa",
  "saga", "salma", "sanna", "sara", "selma", "sigrid", "silje", "simone",
  "sofia", "solveig", "sonja", "soren", "stella", "svea", "sven", "tamar",
  "tariq", "tenzin", "theo", "thora", "tobias", "tomas", "tove", "ulrik",
  "una", "valeria", "vera", "viktor", "vilma", "wei", "wilhelm", "yara",
  "yasmin", "yuki", "zaid", "zara", "zoya",
];

/** Fisher-Yates, off the same seeded stream — a shuffle, not a reshuffle. */
function shuffled(items: readonly string[], rand: () => number) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Cells are placed by centre and then pulled inside the frame, label included.
 *
 * The screenshot this replaced was a viewport grab, so it cut through the top
 * row's captions — half a word at the frame edge reads as an accident rather
 * than a bleed. Clamping every centre by its own half-size plus its caption is
 * what makes "nothing is clipped" a property of the layout instead of a lucky
 * crop.
 */
function crowd() {
  const rand = rng(20260817);
  const cellW = CROWD.width / COLS;
  const cellH = CROWD.height / ROWS;
  const cells: string[] = [];
  /**
   * Every box already on the field, blobatar and caption together.
   *
   * The jitter is capped below half a cell so neighbours cannot swap places,
   * but a big near blobatar in one cell still reaches into the next, and the
   * first field this produced had a caption reading `…os` from behind the
   * creature parked on top of it. A grid keeps the field even; only an actual
   * overlap test keeps it legible.
   */
  const placed: Box[] = [];
  const pool = shuffled(NAMES, rand);
  let n = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Jitter of up to ±40% of a cell. Capping it below half a cell is what
      // stops neighbours from swapping places and collapsing back into the
      // clumping the grid exists to avoid.
      const jx = (rand() - 0.5) * 0.8;
      const jy = (rand() - 0.5) * 0.8;
      const pick = Math.floor(rand() * DEPTHS.length);
      // On the creature, not on the pair. The site tilts the whole column
      // because the wall is in motion and a tilted caption reads as the
      // blobatar carrying its name; frozen in a PNG it just reads as text set
      // crooked, and mono at 11px is exactly the size that makes that obvious.
      const rotate = (rand() - 0.5) * 16;
      const skip = rand() < SKIP;
      // Indexed by what has actually landed, not by cell: a skipped or dropped
      // cell must not burn a name and leave a gap in the crowd's roster.
      const name = pool[n % pool.length]!;
      // The suffix is what the site's wall adds per visit: it keeps two cells
      // showing the same handle from also showing the same creature.
      const seed = `${name}${100 + Math.floor(rand() * 900)}`;
      if (skip) continue;

      // A near blobatar reaches past its cell, so the first pass at rejection
      // simply dropped the loser and left holes where the field was busiest —
      // the opposite of what a crowd shot wants. Falling back through the
      // depths instead turns a collision into distance: the cell keeps its
      // creature, smaller and further away, and only gives up if even the far
      // size has nowhere to sit.
      let put: { depth: (typeof DEPTHS)[number]; box: Box; x: number; y: number } | null =
        null;

      for (let d = pick; d >= 0 && !put; d--) {
        const depth = DEPTHS[d]!;
        const below = depth.label ? CAP_GAP + CAP_LINE : 0;
        // The rotation swings a corner out past the half-width, so the inset is
        // taken against the diagonal rather than the box.
        const reach = (depth.size / 2) * Math.SQRT2;
        const x = clamp((col + 0.5 + jx) * cellW, reach, CROWD.width - reach);
        const y = clamp(
          (row + 0.5 + jy) * cellH,
          reach,
          CROWD.height - reach - below,
        );

        // Captions are wider than the creature they name, and that width is
        // what usually collides — so the box is the union of the two, measured
        // at the mono advance rather than guessed.
        const capW = depth.label ? name.length * 6.6 : 0;
        const box = {
          x0: x - Math.max(reach, capW / 2) - GUTTER,
          x1: x + Math.max(reach, capW / 2) + GUTTER,
          y0: y - reach - GUTTER,
          y1: y + reach + below + GUTTER,
        };

        if (!placed.some((p) => hits(p, box))) put = { depth, box, x, y };
      }

      if (!put) continue;
      placed.push(put.box);

      cells.push(`
  <div class="c" style="left:${put.x.toFixed(1)}px;top:${put.y.toFixed(1)}px">
    <div class="r">
      <div style="width:${put.depth.size}px;height:${put.depth.size}px;transform:rotate(${rotate.toFixed(1)}deg)">${blobatar(seed)}</div>
      ${put.depth.label ? `<span>${name}</span>` : ""}
    </div>
  </div>`);
      n++;
    }
  }

  console.log(`  ${n} blobatars`);

  return page(
    CROWD.width,
    CROWD.height,
    `.c { position: absolute; translate: -50% -50% }
     .r { display: flex; flex-direction: column; align-items: center; gap: ${CAP_GAP}px }
     .c span {
       color: ${LABEL}; font-size: 11px; line-height: ${CAP_LINE}px;
       letter-spacing: 0.02em;
     }`,
    `<div style="position:relative;width:100%;height:100%">${cells.join("")}</div>`,
  );
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

type Box = { x0: number; x1: number; y0: number; y1: number };

/** Breathing room around each box, so "not overlapping" also reads as separate. */
const GUTTER = 5;

const hits = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

type Cell = { label: string; name: string; opts?: BlobatarOptions };
type Row = { cells: Cell[]; size: number };

/**
 * Shape is a pinned trait, not a prop, so these are positions in [0, 1) — the
 * midpoints of the bands `shapeOf` splits that range into. Midpoints because
 * the bands are frozen per major but their boundaries are where a retune lands.
 */
const SHAPES = [
  { label: "round", at: 0.14 },
  { label: "organic", at: 0.43 },
  { label: "boxy", at: 0.65 },
  { label: "nub", at: 0.78 },
  { label: "cloud", at: 0.885 },
  { label: "sun", at: 0.965 },
] as const;

/** Eight stops around the wheel, the same set the site's hue picker offers. */
const HUES = [12, 40, 78, 140, 190, 225, 275, 320];

/**
 * The whole roster, in the order `expression-spec.md` introduces it. Sixteen
 * cells at this size are wider than the sheet, so the row is split in two —
 * `EXPRESSION_ROWS` is where that break lives, not a claim about the poses.
 */
const EXPRESSIONS: { label: string; value?: Expression }[] = [
  { label: "idle" },
  { label: "happy", value: happy },
  { label: "sad", value: sad },
  { label: "mad", value: mad },
  { label: "sleepy", value: sleepy },
  { label: "excited", value: excited },
  { label: "suspicious", value: suspicious },
  { label: "bashful", value: bashful },
  { label: "surprised", value: surprised },
  { label: "wink", value: wink },
  { label: "smug", value: smug },
  { label: "unsure", value: unsure },
  { label: "scared", value: scared },
  { label: "love", value: love },
  { label: "shy", value: shy },
  { label: "sick", value: sick },
];

const EXPRESSION_ROWS = [EXPRESSIONS.slice(0, 8), EXPRESSIONS.slice(8)];

const BACKGROUNDS = ["none", "squircle", "circle", "square"] as const;

const SHEET_ROWS: Row[] = [
  {
    size: 88,
    cells: SHAPES.map((s, i) => ({
      label: s.label,
      name: "shape",
      opts: { traits: { shape: s.at }, hue: HUES[i + 1] },
    })),
  },
  {
    size: 88,
    cells: HUES.map((h) => ({ label: `hue=${h}`, name: "hue", opts: { hue: h } })),
  },
  ...EXPRESSION_ROWS.map((row) => ({
    size: 88,
    cells: row.map((e) => ({
      label: e.label,
      name: "emil",
      opts: { expression: e.value } as BlobatarOptions,
    })),
  })),
  {
    size: 88,
    cells: BACKGROUNDS.map((bg) => ({
      label: bg,
      name: "gita",
      opts: { background: bg === "none" ? false : bg } as BlobatarOptions,
    })),
  },
];

const SHEET = { width: 1400, out: join(MEDIA, "sheet.png") };
const PAD = 52;
const ROW_GAP = 36;
const SHEET_CAP_GAP = 14;
const SHEET_CAP_LINE = 18;

const SHEET_HEIGHT =
  PAD * 2 +
  ROW_GAP * (SHEET_ROWS.length - 1) +
  SHEET_ROWS.reduce(
    (h, r) => h + r.size + SHEET_CAP_GAP + SHEET_CAP_LINE,
    0,
  );

const sheetCell = (c: Cell, size: number) => `
  <figure style="width:${size + 56}px;height:${size + SHEET_CAP_GAP + SHEET_CAP_LINE}px">
    <div style="width:${size}px;height:${size}px">${blobatar(c.name, c.opts)}</div>
    <figcaption>${c.label}</figcaption>
  </figure>`;

const sheet = () =>
  page(
    SHEET.width,
    SHEET_HEIGHT,
    `body {
       display: flex; flex-direction: column; align-items: center;
       gap: ${ROW_GAP}px; padding: ${PAD}px 32px;
     }
     .row { display: flex; justify-content: center; align-items: flex-end; gap: 4px }
     figure { display: flex; flex-direction: column; align-items: center; gap: ${SHEET_CAP_GAP}px }
     figcaption {
       color: ${LABEL}; font-size: 13px; letter-spacing: 0.02em;
       line-height: ${SHEET_CAP_LINE}px;
     }`,
    SHEET_ROWS.map(
      (r) =>
        `<div class="row">${r.cells.map((c) => sheetCell(c, r.size)).join("")}</div>`,
    ).join("\n"),
  );

// ---------------------------------------------------------------------------
// Rasterizing
// ---------------------------------------------------------------------------

const tmp = join(process.env.TMPDIR ?? "/tmp", `blobatar-media-${process.pid}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(MEDIA, { recursive: true });

const bin = [
  process.env.CHROME,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
]
  .filter(Boolean)
  .find((b) => spawnSync(b as string, ["--version"]).status === 0);

if (!bin) {
  rmSync(tmp, { recursive: true, force: true });
  console.error("No Chrome found — set CHROME to a binary that can screenshot.");
  process.exit(1);
}

function shoot(name: string, html: string, width: number, height: number, out: string) {
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, html);

  const shot = spawnSync(bin as string, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--force-device-scale-factor=${SCALE}`,
    `--user-data-dir=${join(tmp, "profile")}`,
    `--window-size=${width},${height + FRAME}`,
    `--screenshot=${out}`,
    `file://${file}`,
  ]);

  if (shot.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    console.error(shot.stderr.toString());
    process.exit(1);
  }

  // The page is top-aligned in the viewport, so the slack is all at the bottom
  // and the crop is a fixed rectangle from the origin.
  const crop = spawnSync("convert", [
    out,
    "-crop",
    `${width * SCALE}x${height * SCALE}+0+0`,
    "+repage",
    // Chrome's pixels are already deterministic; ImageMagick's timestamp
    // chunks are not, and without these two a re-run that changed nothing
    // still shows up as a modified binary in `git status`.
    "-define",
    "png:exclude-chunk=date,time",
    "+set",
    "date:create",
    "+set",
    "date:modify",
    out,
  ]);

  if (crop.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    console.error(
      `ImageMagick's \`convert\` failed — ${out} is uncropped and carries ` +
        `${FRAME}px of dead ink along the bottom.`,
    );
    process.exit(1);
  }

  console.log(`wrote ${out}`);
}

shoot("crowd", crowd(), CROWD.width, CROWD.height, CROWD.out);
shoot("sheet", sheet(), SHEET.width, SHEET_HEIGHT, SHEET.out);

rmSync(tmp, { recursive: true, force: true });
