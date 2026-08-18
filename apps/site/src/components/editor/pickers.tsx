import { Blobatar } from "sketchy-blobatar/react";
import { palette } from "sketchy-blobatar";
import { SHAPES, TONES } from "@/editor/axes";
import { cn } from "@/lib/utils";

/**
 * The two categorical axes.
 *
 * Both are read by the layout as *bands* rather than as numbers — `shapeOf`
 * splits [0, 1) into six silhouettes, `toneAt` into six swatches — so a slider
 * would be a control with five invisible detents. A picker states the bands,
 * and pinning one writes its midpoint.
 *
 * Neither is a `<select>`, and for the reason the hero's shape row gives: "nub"
 * and "pale neutral" are words for things nobody has seen yet. Both rows show
 * the thing.
 */

/** The `auto` option, in both pickers: unpinned, so the name decides. */
const AUTO = "auto";

export function ShapePicker({
  name,
  traits,
  value,
  onPick,
}: {
  name: string;
  /** Everything else currently pinned, so the row restyles as you tune. */
  traits: Record<string, number>;
  value?: number;
  onPick: (at: number | null) => void;
}) {
  const { shape: _pinned, ...rest } = traits;

  return (
    <div className="grid grid-cols-4 gap-1" role="group" aria-label="Silhouette">
      <Tile
        label={AUTO}
        name={name}
        traits={rest}
        selected={value === undefined}
        onClick={() => onPick(null)}
      />
      {SHAPES.map(s => (
        <Tile
          key={s.name}
          label={s.name}
          name={name}
          traits={{ ...rest, shape: s.at }}
          selected={value === s.at}
          onClick={() => onPick(s.at)}
        />
      ))}
    </div>
  );
}

/**
 * One silhouette, rendered as itself — the hero's `ShapeTile`, kept separate
 * rather than shared because the two differ in exactly the way that matters:
 * that one carries a whole `BlobatarOptions` (hue, pose, background) and this
 * one carries a trait map. Merging them would mean a component that takes both.
 *
 * Static `<img>`s deliberately. Seven live SVG trees beside a preview that is
 * supposed to be the thing you are watching is seven things competing with it.
 */
function Tile({
  label,
  name,
  traits,
  selected,
  onClick,
}: {
  label: string;
  name: string;
  traits: Record<string, number>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-150",
        selected ? "bg-line/70" : "hover:bg-line/30",
      )}
    >
      <Blobatar name={name || " "} traits={traits} alt="" className="size-9" />
      <span
        className={cn(
          "font-mono text-[0.6rem] lowercase transition-colors",
          selected ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function TonePicker({
  hue,
  value,
  onPick,
}: {
  /** The hue currently on screen, in degrees — the swatches wear it. */
  hue: number;
  value?: number;
  onPick: (at: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Tone">
      <Chip label={AUTO} selected={value === undefined} onClick={() => onPick(null)} />
      {TONES.map(t => (
        <Chip
          key={t.name}
          label={t.name}
          // The chip is the swatch: `palette` is the same function the renderer
          // calls, so what is on the chip is what the body will be — not an
          // approximation of it authored beside the real one.
          swatch={palette(hue, true, t.at).head}
          selected={value === t.at}
          onClick={() => onPick(t.at)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  swatch,
  selected,
  onClick,
}: {
  label: string;
  swatch?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "border-line inline-flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5",
        "text-[0.65rem] lowercase transition-colors duration-150",
        selected ? "text-ink bg-line/70" : "text-muted hover:text-ink hover:bg-line/30",
      )}
    >
      <span
        aria-hidden="true"
        className="size-3 rounded-full"
        // `auto` has no swatch of its own — it is whatever the name produces,
        // and a chip that guessed at one would be wrong for every other name.
        style={swatch ? { background: swatch } : { border: "1px dashed var(--color-muted)" }}
      />
      {label}
    </button>
  );
}
