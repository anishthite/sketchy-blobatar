import type { CSSProperties, FC } from "react";
import { Blobatar } from "blobatar/react";
import { idle, type Expression } from "blobatar/expression";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { MONO, SANS } from "./fonts";
import {
  B_CARD,
  B_GRID,
  CELL,
  FPS,
  GRID_IN,
  HEIGHT,
  HERO,
  HERO_BLOB,
  HERO_X,
  HERO_Y,
  MORPH,
  NEW,
  REEL_FROM,
  ROWS,
  TILE_BLOB,
  TIME_OFFSET,
  WIDTH,
  cellOf,
  morph,
  blinkTime,
  reelAt,
  tilePhase,
  type Slot,
} from "./reel";
import "blobatar/motion.css";
import "./seek.css";

const BG = "#0b0b0c";
const TEXT = "#f2f2f3";
const MUTED = "#8a8a8f";
const DIM = "#6a6a6f";

const ease = Easing.inOut(Easing.cubic);

const ramp = (
  frame: number,
  from: number,
  to: number,
  a: number,
  b: number,
  easing = ease,
) =>
  interpolate(frame, [from, to], [a, b], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** How far a tile's name sits under the centre it is drawn on. */
const LABEL_DROP = 60;

/** The hero's cell — the pose the reel ends on, so it lands where it stopped. */
const LAST = NEW[NEW.length - 1]!;
const HOME = cellOf(LAST.name);

/** A tile's distance from the hero's cell, in cells. */
const distFromHero = (name: string) => {
  const { x, y } = cellOf(name);
  return Math.hypot(x - HOME.x, y - HOME.y) / CELL;
};

/**
 * The face the hero wears on a frame, and the film's only real state.
 *
 * Every value it returns is a fresh `Expression` built by `morph`, including the
 * held ones — a hold is the morph at t=1. Written that way rather than handing
 * back the roster's own object at the ends, because the two paths would then
 * differ in identity and React would rebuild the subtree on the frame the hold
 * begins. Same face, one code path.
 */
function heroExpression(frame: number): Expression {
  if (frame < REEL_FROM) return morph(idle, idle, 1);
  const { i, local } = reelAt(frame);
  if (i >= NEW.length) return morph(LAST.e, LAST.e, 1);
  const from = i === 0 ? idle : NEW[i - 1]!.e;
  return morph(from, NEW[i]!.e, ramp(local, 0, MORPH, 0, 1));
}

/** The pose being named, and how visible its name is. */
function heroLabel(frame: number): { name: string; opacity: number } {
  if (frame < REEL_FROM) return { name: "idle", opacity: 1 };
  const { i, local } = reelAt(frame);
  if (i >= NEW.length) return { name: LAST.name, opacity: 1 };
  const prev = i === 0 ? "idle" : NEW[i - 1]!.name;
  const t = local / MORPH;

  // The name blinks out and back rather than cross-fading, because the two
  // strings are different lengths: a cross-fade would slide the line sideways
  // under the reader mid-word. Swapping at the point where the span is at zero
  // makes the width change unobservable.
  if (t >= 1) return { name: NEW[i]!.name, opacity: 1 };
  return {
    name: t < 0.5 ? prev : NEW[i]!.name,
    opacity: Math.abs(t * 2 - 1),
  };
}

/**
 * The caption, written as the prop you would actually pass.
 *
 * `expression={surprised}` rather than a bare word: the pose names are exported
 * identifiers, and a viewer who reads the line has already read the API. The
 * name sits in a fixed-width box so a nine-letter pose and a three-letter one
 * leave `expression={` in the same place.
 */
const Caption: FC<{ frame: number }> = ({ frame }) => {
  const { name, opacity } = heroLabel(frame);
  const fade =
    ramp(frame, 12, 30, 0, 1) * ramp(frame, B_GRID - 14, B_GRID, 1, 0);

  return (
    <div
      style={{
        position: "absolute",
        top: HERO_Y + 300,
        left: 0,
        width: WIDTH,
        textAlign: "center",
        fontFamily: MONO,
        fontSize: 34,
        letterSpacing: "0.04em",
        color: MUTED,
        opacity: fade,
      }}
    >
      expression=&#123;
      <span
        style={{
          display: "inline-block",
          width: 215,
          textAlign: "center",
          color: TEXT,
          opacity,
        }}
      >
        {name}
      </span>
      &#125;
    </div>
  );
};

/**
 * A roster tile: the blobatar, its name, and nothing else.
 *
 * The blobatar is centred on the cell's centre and the label hangs below it
 * absolutely, rather than the two sharing a flow. That is what lets the hero —
 * which is not in this component at all, and never enters it — park on the same
 * point and line up with the twelve around it.
 */
const Tile: FC<{
  slot: Slot;
  frame: number;
  fresh: boolean;
  delay: number;
  phase: Record<string, string>;
}> = ({ slot, frame, fresh, delay, phase }) => {
  const at = B_GRID + delay;
  const arrive = ramp(frame, at, at + 16, 0, 1, Easing.out(Easing.cubic));
  const pop = ramp(frame, at, at + 16, 0.86, 1, Easing.out(Easing.cubic));
  const { x, y } = cellOf(slot.name);

  return (
    <div
      style={{
        position: "absolute",
        left: x - CELL / 2,
        top: y - CELL / 2,
        width: CELL,
        height: CELL,
        display: "grid",
        placeItems: "center",
        // The four that already shipped sit back so the nine read as the news.
        // Dimmed rather than omitted: "nine new" is a claim about a roster, and
        // the roster has to be on screen for the claim to mean anything.
        opacity: arrive * (fresh ? 1 : 0.4),
        transform: `scale(${pop})`,
      }}
    >
      <Blobatar
        name={HERO}
        expression={slot.e}
        animate="always"
        size={TILE_BLOB}
        style={phase as CSSProperties}
      />
      <div
        style={{
          position: "absolute",
          top: CELL / 2 + LABEL_DROP,
          left: 0,
          width: CELL,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 19,
          letterSpacing: "0.02em",
          color: fresh ? TEXT : DIM,
        }}
      >
        {slot.name}
      </div>
    </div>
  );
};

/**
 * The end card, under the grid rather than beside it.
 *
 * The launch film puts the wordmark next to the creature because it has one
 * creature. This one has thirteen and they are the point, so the card takes the
 * bottom strip and the grid keeps the frame.
 */
const Card: FC<{ frame: number }> = ({ frame }) => {
  const opacity = ramp(frame, B_CARD, B_CARD + 30, 0, 1);
  const lift = ramp(frame, B_CARD, B_CARD + 30, 14, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 830,
        width: WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 62,
          fontWeight: 500,
          letterSpacing: "-0.05em",
          lineHeight: 0.9,
          color: TEXT,
        }}
      >
        nine new expressions
      </div>
      <div style={{ fontFamily: MONO, fontSize: 25, color: MUTED }}>
        npm i blobatar
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 19,
          color: DIM,
          letterSpacing: "0.01em",
        }}
      >
        zero dependencies · ~3.7 KB · MIT
      </div>
    </div>
  );
};

/** The line above the reel. Present from the first frame; it is the headline. */
const Kicker: FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      top: 96,
      left: 0,
      width: WIDTH,
      textAlign: "center",
      fontFamily: MONO,
      fontSize: 21,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: DIM,
      opacity: ramp(frame, 0, 18, 0, 1) * ramp(frame, B_GRID - 14, B_GRID, 1, 0),
    }}
  >
    blobatar · one name, thirteen faces
  </div>
);

export const Expressions: FC = () => {
  const frame = useCurrentFrame();

  // The hero is drawn once at reel size and scaled into its tile, so the same
  // element survives the whole film. Sizing it down instead would hand React a
  // different `size` and rebuild the SVG, which is the one thing a no-cut film
  // cannot afford — and the tile is a pure downscale of a 460px render, so it
  // is sharper than a 132px one, not softer.
  const scale = ramp(frame, B_GRID, B_GRID + GRID_IN, 1, TILE_BLOB / HERO_BLOB);
  const x = ramp(frame, B_GRID, B_GRID + GRID_IN, HERO_X, HOME.x);
  const y = ramp(frame, B_GRID, B_GRID + GRID_IN, HERO_Y, HOME.y);

  const heroLabelOpacity = ramp(frame, B_GRID + GRID_IN - 8, B_GRID + GRID_IN, 0, 1);

  return (
    <div
      style={{
        ["--vid-t" as string]: `${(frame / FPS) * 1000 + TIME_OFFSET}ms`,
        ["--vid-blink-t" as string]: `${blinkTime(frame)}ms`,
        width: WIDTH,
        height: HEIGHT,
        background: BG,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Kicker frame={frame} />

      {frame >= B_GRID &&
        ROWS.map((row, r) =>
          row.map((slot, i) =>
            slot.name === LAST.name ? null : (
              <Tile
                key={slot.name}
                slot={slot}
                frame={frame}
                fresh={r > 0}
                // Staggered outward from the hero's cell, so the grid assembles
                // from the creature the viewer is already watching. Measured in
                // cells off the real coordinates, so re-shaping the rows cannot
                // leave the stagger radiating from somewhere the hero is not.
                delay={distFromHero(slot.name) * 4}
                phase={tilePhase(r * 5 + i)}
              />
            ),
          ),
        )}

      {/* The hero's own label, faded in only once it has parked. */}
      {frame >= B_GRID && (
        <div
          style={{
            position: "absolute",
            left: HOME.x - CELL / 2,
            top: HOME.y + LABEL_DROP,
            width: CELL,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 19,
            letterSpacing: "0.02em",
            color: TEXT,
            opacity: heroLabelOpacity,
          }}
        >
          {LAST.name}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <Blobatar
          name={HERO}
          expression={heroExpression(frame)}
          animate="always"
          size={HERO_BLOB}
        />
      </div>

      <Caption frame={frame} />
      {frame >= B_CARD && <Card frame={frame} />}
    </div>
  );
};
