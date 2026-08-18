/**
 * Every number the launch video is cut on, and the solve that places the hero's
 * blink and glance where the edit wants them.
 *
 * The video is one continuous shot. There are no cuts: a camera transform over
 * a single grid does all five beats, so the blobatar that opens the film is
 * literally the same element that closes it. That is the whole argument for the
 * structure — determinism is the pitch, and a cut would let a viewer suspect
 * the closing creature was re-rendered rather than the same one, which is
 * exactly the doubt the round-trip beat exists to remove.
 */

import { traits } from "sketchy-blobatar";
import { motionVars } from "sketchy-blobatar/animate";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** 15 × 8 at 128px fills 1920 exactly and leaves 28px of letterbox top and bottom. */
export const CELL = 128;
export const COLS = 15;
export const ROWS = 8;
export const GRID_Y = (HEIGHT - ROWS * CELL) / 2;

export const HERO_COL = 7;
export const HERO_ROW = 3;
export const HERO = "alain00";

/**
 * The round-trip, as single-character edits at one index.
 *
 * Index 3 and nowhere else: the eye has to be able to track *which* character
 * moved, and a mutation that wanders across the string reads as a new name
 * rather than a typo. `i → o` and `i → u` are both keyboard neighbours of `i`,
 * so the sequence reads as a slip and a correction, which is the story — a name
 * that survives being mistyped and retyped.
 *
 * Chosen by sweeping every single-character edit of `alain00` for ones landing
 * in a different shape band *and* more than 80° of hue away, so the snap is
 * unmissable at a glance:
 *
 *   alain00  round  hue 236   (blue)
 *   alaon00  nub    hue 136   (green)
 *   alaun00  nub    hue  52   (amber)
 */
export const MUT_INDEX = 3;
export const MUT_1 = "alaon00";
export const MUT_2 = "alaun00";

// Beat boundaries.
export const B_ONE = 0;
export const B_TRIP = 75;
export const B_CROWD = 225;
export const B_FIND = 435;
export const B_CARD = 540;
export const END = 615;

/**
 * Inside the round-trip.
 *
 * The holds are the shortest thing that still reads. A mutation is a snap, so
 * what a hold buys is not the change but the recognition after it — about a
 * second, which is 30 frames. The revert gets half again as long because it is
 * the only beat asking the viewer to compare against a memory rather than
 * against the previous frame, and that is the one thing in the film that cannot
 * be re-shown.
 */
export const TYPE_FROM = 78;
export const TYPE_TO = 96;
export const MUT_1_AT = 114;
export const MUT_2_AT = 147;
export const REVERT_AT = 177;

// Inside the crowd: pull back, then hold with the camera completely still.
export const PULL_TO = 345;

/**
 * Where the hero's blink and glance are wanted.
 *
 * Stated as offsets from the push-in rather than as absolute frames: they are
 * facts about that shot, and an edit that moves the shot must move them with
 * it or the solver silently schedules a blink into the wrong beat.
 */
const BLINK_FRAME = B_FIND + 30;
const GLANCE_FROM = B_FIND + 65;
const GLANCE_TO = B_FIND + 100;

const ms = (frame: number) => (frame / FPS) * 1000;

/** `-1234ms` → `1234`. The vars ship negated; a phase is the positive number. */
const phaseOf = (v: string | undefined) => Math.abs(parseFloat(v ?? "0"));
const periodOf = (v: string | undefined) => parseFloat(v ?? "0");

/**
 * `@keyframes mo-blink` holds the eye open until 97.2%, shuts it at 98.6% and
 * reopens by 100%. The closed frame is the one worth landing on.
 */
const BLINK_CLOSED = 0.986;

/**
 * Where `@keyframes mo-saccade` moves rather than holds. Each pair is a hold
 * ending and the next fixation beginning, so the eyes are in motion between
 * them and nowhere else.
 */
const SACCADE_MOVES: ReadonlyArray<readonly [number, number]> = [
  [0.15, 0.165],
  [0.31, 0.325],
  [0.47, 0.485],
  [0.63, 0.645],
  [0.79, 0.805],
  [0.985, 1.0],
];

/**
 * The global time offset, in ms, added to every frame's `--mo-t`.
 *
 * Seeking is what makes this possible at all: the idle loops are seeded per
 * name and would otherwise blink wherever they happened to blink, which on a
 * three-second push-in is a coin flip. Shifting the *whole* film in time costs
 * nothing — every blobatar is phase-seeded, so a crowd shifted by four seconds
 * is the same crowd — and it buys an exact blink on the frame the edit wants.
 *
 * One offset cannot satisfy two constraints exactly, so the blink is solved for
 * and the glance is scored: candidates are the offsets that put a blink on
 * `BLINK_FRAME`, one per blink cycle, and the winner is the first that also
 * lands an eye movement inside the glance window.
 */
function solveOffset(): number {
  const vars = motionVars(traits(HERO));
  const blinkPeriod = periodOf(vars["--mo-blink"]);
  const blinkPhase = phaseOf(vars["--mo-blink-phase"]);
  const saccadePeriod = periodOf(vars["--mo-saccade"]);
  const saccadePhase = phaseOf(vars["--mo-saccade-phase"]);

  const glances = (offset: number) => {
    // Local time of the saccade loop at a given frame time.
    const local = (t: number) => t + offset + saccadePhase;
    const from = local(ms(GLANCE_FROM));
    const to = local(ms(GLANCE_TO));
    for (let m = Math.floor(from / saccadePeriod); m <= Math.ceil(to / saccadePeriod); m++) {
      for (const [a, b] of SACCADE_MOVES) {
        const mid = (m + (a + b) / 2) * saccadePeriod;
        if (mid >= from && mid <= to) return true;
      }
    }
    return false;
  };

  let fallback = 0;
  for (let k = 0; k < 400; k++) {
    // Solve `(k + closed) * period - phase = ms(BLINK_FRAME) + offset`.
    const offset = (k + BLINK_CLOSED) * blinkPeriod - blinkPhase - ms(BLINK_FRAME);
    if (offset < 0) continue;
    if (!fallback) fallback = offset;
    if (glances(offset)) return offset;
  }
  return fallback;
}

export const TIME_OFFSET = solveOffset();

/** The hero's name on a given frame — the round-trip, and the whole pitch. */
export const heroName = (frame: number): string => {
  if (frame < MUT_1_AT) return HERO;
  if (frame < MUT_2_AT) return MUT_1;
  if (frame < REVERT_AT) return MUT_2;
  return HERO;
};
