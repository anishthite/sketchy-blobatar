import type { FC } from "react";
import { Blobatar } from "sketchy-blobatar/react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { MONO, SANS } from "./fonts";
import { CROWD } from "./names";
import {
  B_CARD,
  B_CROWD,
  B_FIND,
  CELL,
  COLS,
  FPS,
  GRID_Y,
  HEIGHT,
  HERO_COL,
  HERO_ROW,
  MUT_1_AT,
  MUT_INDEX,
  PULL_TO,
  REVERT_AT,
  ROWS,
  TIME_OFFSET,
  TYPE_FROM,
  TYPE_TO,
  WIDTH,
  heroName,
} from "./timeline";
import "sketchy-blobatar/motion.css";
import "./seek.css";

const BG = "#0b0b0c";
const TEXT = "#f2f2f3";
const MUTED = "#8a8a8f";
const DIM = "#6a6a6f";

/** The blobatar's box inside a cell. The body fills roughly 70% of it. */
const BLOB = 124;

/** Scales chosen so the hero's box reads 459px open and 558px on the push-in. */
const OPEN = 3.7;
const PUSH = 4.5;
const CARD = 1.6;

const HERO_X = (HERO_COL + 0.5) * CELL;
const HERO_Y = GRID_Y + (HERO_ROW + 0.5) * CELL;

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

/**
 * The camera, as a scale and the screen point the hero's centre is pinned to.
 *
 * Written as one function over the whole timeline rather than per-beat clips,
 * because the film has no cuts and this is the only thing that moves between
 * beats. Reading it top to bottom is reading the edit.
 */
function camera(frame: number): { scale: number; x: number; y: number } {
  if (frame < B_CROWD) return { scale: OPEN, x: WIDTH / 2, y: HEIGHT / 2 };

  // Pull back: the hero shrinks into its cell and the crowd arrives around it.
  if (frame < PULL_TO)
    return {
      scale: ramp(frame, B_CROWD, PULL_TO, OPEN, 1),
      x: ramp(frame, B_CROWD, PULL_TO, WIDTH / 2, HERO_X),
      y: ramp(frame, B_CROWD, PULL_TO, HEIGHT / 2, HERO_Y),
    };

  // The hold. The camera is completely still and only the crowd moves — which
  // is the whole shot: 120 creatures breathing out of phase.
  if (frame < B_FIND) return { scale: 1, x: HERO_X, y: HERO_Y };

  // The find.
  if (frame < B_CARD)
    return {
      scale: ramp(frame, B_FIND, B_CARD, 1, PUSH),
      x: ramp(frame, B_FIND, B_CARD, HERO_X, WIDTH / 2),
      y: ramp(frame, B_FIND, B_CARD, HERO_Y, HEIGHT / 2),
    };

  // The card: ease back out and slide left to make room for the wordmark.
  return {
    scale: ramp(frame, B_CARD, B_CARD + 40, PUSH, CARD),
    x: ramp(frame, B_CARD, B_CARD + 40, WIDTH / 2, 660),
    y: HEIGHT / 2,
  };
}

/** A crowd cell's opacity: staggered in by distance, dimmed, then gone. */
function crowdOpacity(frame: number, dist: number): number {
  const at = B_CROWD + dist * 3.2;
  const arrive = ramp(frame, at, at + 14, 0, 1, Easing.out(Easing.cubic));
  const dim = ramp(frame, B_FIND, B_FIND + 65, 1, 0.32);
  const gone = ramp(frame, B_CARD, B_CARD + 35, 1, 0);
  return arrive * dim * gone;
}

const Cell: FC<{ name: string; col: number; row: number; frame: number }> = ({
  name,
  col,
  row,
  frame,
}) => {
  const dist = Math.hypot(col - HERO_COL, row - HERO_ROW);
  const at = B_CROWD + dist * 3.2;
  return (
    <div
      style={{
        position: "absolute",
        left: col * CELL,
        top: GRID_Y + row * CELL,
        width: CELL,
        height: CELL,
        display: "grid",
        placeItems: "center",
        opacity: crowdOpacity(frame, dist),
        transform: `scale(${ramp(frame, at, at + 14, 0.9, 1, Easing.out(Easing.cubic))})`,
      }}
    >
      <Blobatar name={name} animate="always" size={BLOB} />
    </div>
  );
};

/**
 * The name, typed in and then mistyped.
 *
 * The mutating character is the only one that ever changes colour, so the eye
 * has somewhere to be when the blobatar snaps. Without it the viewer is asked
 * to diff two seven-character strings in 1.5 seconds and will not.
 */
const Caption: FC<{ frame: number }> = ({ frame }) => {
  const name = heroName(frame);
  const typed = Math.floor(ramp(frame, TYPE_FROM, TYPE_TO, 0, name.length, Easing.linear));
  const opacity =
    ramp(frame, TYPE_FROM, TYPE_FROM + 6, 0, 1) * ramp(frame, B_CROWD, B_CROWD + 25, 1, 0);

  return (
    <div
      style={{
        position: "absolute",
        top: HEIGHT / 2 + 250,
        left: 0,
        width: WIDTH,
        textAlign: "center",
        fontFamily: MONO,
        fontSize: 34,
        letterSpacing: "0.06em",
        color: MUTED,
        opacity,
      }}
    >
      {name
        .slice(0, typed)
        .split("")
        .map((ch, i) => (
          <span
            key={i}
            style={{
              color: i === MUT_INDEX && frame >= MUT_1_AT ? TEXT : MUTED,
            }}
          >
            {ch}
          </span>
        ))}
    </div>
  );
};

const Card: FC<{ frame: number }> = ({ frame }) => {
  const opacity = ramp(frame, B_CARD + 18, B_CARD + 52, 0, 1);
  const lift = ramp(frame, B_CARD + 18, B_CARD + 52, 12, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: 820,
        top: 0,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 78,
          fontWeight: 500,
          letterSpacing: "-0.055em",
          lineHeight: 0.9,
          color: TEXT,
        }}
      >
        blobatar
      </div>
      <div style={{ fontFamily: MONO, fontSize: 27, color: MUTED }}>npm i blobatar</div>
      <div style={{ fontFamily: SANS, fontSize: 20, color: DIM, letterSpacing: "0.01em" }}>
        zero dependencies · ~3.7 KB · MIT
      </div>
    </div>
  );
};

export const Launch: FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);

  // The crowd is inert until just before it arrives, and mounting it costs a
  // style recalculation across every animated node on every frame. Holding it
  // out of the tree for the first eight seconds is most of the render budget.
  const crowded = frame >= B_CROWD - 20;

  return (
    <div
      style={{
        ["--vid-t" as string]: `${(frame / FPS) * 1000 + TIME_OFFSET}ms`,
        width: WIDTH,
        height: HEIGHT,
        background: BG,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${cam.x - HERO_X * cam.scale}px, ${
            cam.y - HERO_Y * cam.scale
          }px) scale(${cam.scale})`,
        }}
      >
        {crowded &&
          Array.from({ length: COLS * ROWS }, (_, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            if (col === HERO_COL && row === HERO_ROW) return null;
            // The hero's cell is skipped, so the crowd list stays in step with
            // the grid by counting cells before it rather than by index.
            const n = i - (row > HERO_ROW || (row === HERO_ROW && col > HERO_COL) ? 1 : 0);
            return (
              <Cell key={i} name={CROWD[n % CROWD.length]!} col={col} row={row} frame={frame} />
            );
          })}

        <div
          style={{
            position: "absolute",
            left: HERO_COL * CELL,
            top: GRID_Y + HERO_ROW * CELL,
            width: CELL,
            height: CELL,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Blobatar name={heroName(frame)} animate="always" size={BLOB} />
        </div>
      </div>

      {frame < B_CROWD + 25 && <Caption frame={frame} />}
      {frame >= B_CARD && <Card frame={frame} />}
    </div>
  );
};

/** Kept honest: the revert has to restore the opening name exactly. */
if (heroName(0) !== heroName(REVERT_AT)) {
  throw new Error("the round-trip does not round-trip");
}
