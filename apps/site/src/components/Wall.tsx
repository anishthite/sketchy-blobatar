import { useMemo } from "react";
import { Blobatar } from "sketchy-blobatar/react";
import { NAMES, shuffled } from "@/names";
import { useNearViewport } from "@/lib/near-viewport";

/**
 * The field is generated on a jittered grid rather than from raw random
 * coordinates. Pure randomness clumps — you get three blobatars overlapping in
 * one corner and an empty quadrant next to it — whereas one blobatar per cell,
 * nudged off centre, reads as scattered while staying evenly spread.
 */
const COLS = 7;
const ROWS = 9;

/**
 * The heading sits in the middle, so cells whose centre falls inside this box
 * (in normalised 0–1 field coordinates) are skipped. Blobatars can still drift
 * near it, which is what keeps the hole from looking cut out with scissors.
 */
const SAFE = { x0: 0.28, x1: 0.72, y0: 0.36, y1: 0.64 };

/**
 * Three depth layers. The number a layer carries is its scroll parallax shift
 * and its scale in one: near blobatars are bigger and travel further, far ones
 * are smaller and barely move. Tying both to a single value is what makes the
 * depth read as depth rather than as two unrelated randomisations.
 */
const DEPTHS = [
  { shift: "1.5rem", size: "clamp(1.75rem, 4vw, 3.25rem)", label: false },
  { shift: "4rem", size: "clamp(2.25rem, 5.5vw, 4.5rem)", label: true },
  { shift: "8rem", size: "clamp(3rem, 7vw, 6rem)", label: true },
];

type Blob = {
  seed: string;
  name: string;
  left: number;
  top: number;
  depth: number;
  rotate: number;
  duration: number;
  delay: number;
};

export function Wall() {
  /*
   * The field is client-only, and waits for the scroll that reveals it.
   *
   * Client-only because it is built from `Math.random()`, so a prerendered
   * field and the one the client generates would never match, and because sixty
   * inline SVGs in the document costs a round trip on the way to first paint.
   *
   * Deferred to intersection rather than to mount because rendering it at
   * hydration put a thousand elements' worth of work directly into the window
   * Total Blocking Time measures — see `useNearViewport`. The heading below
   * renders either way, so the section is never empty of meaning.
   */
  const [ref, near] = useNearViewport<HTMLElement>();

  // Once per mount, not per render: a reshuffle on every state change would
  // make the wall flicker. Random per visit is the point — the claim is
  // "millions of options", and a field that is provably different on every
  // reload is the cheapest possible proof.
  const blobs = useMemo<Blob[]>(() => {
    if (!near) return [];

    const pool = shuffled(NAMES);
    const out: Blob[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Cell centre, then a jitter of up to ±40% of a cell. Capping it below
        // half a cell is what stops neighbours from swapping places and
        // collapsing back into the clumping this grid exists to avoid.
        const x = (c + 0.5 + (Math.random() - 0.5) * 0.8) / COLS;
        const y = (r + 0.5 + (Math.random() - 0.5) * 0.8) / ROWS;

        if (x > SAFE.x0 && x < SAFE.x1 && y > SAFE.y0 && y < SAFE.y1) continue;
        // A tenth of the cells stay empty. A perfectly populated grid is still
        // legible as a grid; the gaps are what break the last of the rhythm.
        if (Math.random() < 0.1) continue;

        const name = pool[out.length % pool.length]!;
        out.push({
          seed: `${name}${Math.floor(Math.random() * 900) + 100}`,
          name,
          left: x * 100,
          top: y * 100,
          depth: Math.floor(Math.random() * DEPTHS.length),
          rotate: (Math.random() - 0.5) * 16,
          // Each blobatar floats on its own clock. Shared timing would have the
          // whole field rising and falling as one sheet, which is the one thing
          // a drifting crowd must not do.
          duration: 5 + Math.random() * 5,
          delay: -Math.random() * 10,
        });
      }
    }

    return out;
  }, [near]);

  return (
    /*
      `overflow-clip`, not `overflow-hidden`. `hidden` makes this element a
      scroll container, and a scroll container is what `animation-timeline:
      view()` resolves against — so the layers measured their progress against
      a box that never scrolls and sat frozen at the identity transform. `clip`
      clips the same way without becoming a scroller.
    */
    <section ref={ref} className="relative min-h-[150vh] overflow-clip">
      {/*
        One positioned layer per depth, each with its own scroll shift, and the
        blobatars parented into whichever one they belong to. Doing the parallax
        on three wrappers rather than on sixty blobatars keeps the scroll-driven
        animation count at three, and leaves each blobatar's own transform free
        for its float.
      */}
      {DEPTHS.map((depth, d) => (
        <div
          key={d}
          className="wall-layer absolute inset-0"
          style={{ "--wall-shift": depth.shift } as React.CSSProperties}
          // Decorative: the heading over it carries the meaning, and sixty
          // seeds announced one by one is noise to a screen reader.
          aria-hidden="true"
        >
          {blobs
            .filter(b => b.depth === d)
            .map(b => (
              <div
                key={b.seed}
                className="wall-float absolute"
                style={
                  {
                    left: `${b.left}%`,
                    top: `${b.top}%`,
                    // Centring goes on `translate`, not `transform`: the float
                    // animation owns `transform`, and the two would otherwise
                    // overwrite each other. Separate properties compose.
                    translate: "-50% -50%",
                    "--float-duration": `${b.duration}s`,
                    "--float-delay": `${b.delay}s`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="flex flex-col items-center gap-1.5"
                  style={{ transform: `rotate(${b.rotate}deg)` }}
                >
                  {/*
                    `hover`, not `always`. Sixty blobatars idling continuously is
                    visual noise competing with the heading, and sixty live
                    animations under a scroll-linked transform is the one thing
                    that would make this section stutter. Still until pointed at.
                  */}
                  <Blobatar
                    name={b.seed}
                    animate="hover"
                    className="shrink-0"
                    style={{ width: depth.size, height: depth.size }}
                  />
                  {/*
                    Only the two nearer depths are labelled. At the far size the
                    text would be smaller than it is readable, and a wall of
                    illegible captions is texture, not information.
                  */}
                  {depth.label && (
                    // Dropped below `sm`: the cells are narrow enough there
                    // that captions land on their neighbours.
                    <span className="text-ink/50 hidden font-mono text-[0.6rem] lowercase sm:block">
                      {b.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      ))}

      {/*
        Feathered top and bottom so the field enters and leaves the section
        rather than being clipped by a hard edge.
      */}
      <div className="from-ground pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b to-transparent" />
      <div className="from-ground pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t to-transparent" />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/*
            The clearing behind the heading, as a separate layer rather than a
            background on the `h2`. Against a scattered field a plain padded box
            reads as a rectangle laid over the blobatars; a radial fade to nothing
            makes the field look like it thins around the words instead.

            A tint, not a blur. Masking a `backdrop-blur` bands badly here — the
            blur quantises the near-black ground, and the mask's alpha ramp
            turns those steps into visible concentric rings. A plain gradient in
            the ground colour has nothing to quantise.

            The far stop is the ground colour at zero alpha, not the `transparent`
            keyword. `transparent` is *transparent black*, and the ground is
            #0a0a0b rather than #000 — so interpolating to it dips through
            colours darker than the page and paints a visible dark ring around
            the heading on top of the very field it is meant to disappear into.
          */}
          <div
            className="absolute -inset-x-40 -inset-y-32"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at center, var(--color-ground) 0%, var(--color-ground) 32%, rgb(from var(--color-ground) r g b / 0) 70%)",
            }}
          />
          <h2 className="relative text-center text-[clamp(2.5rem,9vw,6rem)] leading-[0.9] font-medium tracking-[-0.05em]">
            Millions
            <br />
            of options
          </h2>
        </div>
      </div>
    </section>
  );
}
