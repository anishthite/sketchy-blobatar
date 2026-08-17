import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/**
 * A single-value slider, in shadcn's idiom over Radix — the same trade the
 * segmented control makes, and for the same reason: keyboard stepping, page-up
 * and -down, RTL, pointer capture and touch are the component, and the visible
 * part is three divs.
 *
 * One addition upstream has no notion of: `ghost`, a second mark on the track
 * at the position the layout *resolved* to. Every other control on this page
 * states what it asked for; the two the eye-cluster fit can pull back have to
 * be able to state what they got. See `editor/resolved.ts`.
 */
export function Slider({
  ghost,
  className,
  // Pulled off the root and put on the thumb below, because the thumb is the
  // element carrying `role="slider"` — a label on the root names a wrapper
  // nothing announces, which is the same as no label at all.
  "aria-label": label,
  "aria-valuetext": valueText,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { ghost?: number }) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "group relative flex h-4 w-full touch-none items-center select-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-35",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="bg-line relative h-[3px] w-full grow rounded-full">
        <SliderPrimitive.Range className="bg-muted absolute h-full rounded-full" />
        {ghost !== undefined && (
          /*
            After the range so it draws over the fill rather than under it —
            the whole point is the gap between the two, and the mark sits inside
            the filled part by definition.

            `aria-hidden` because it is not a second value: the control's own
            `aria-valuenow` is what was asked for, and the row states the
            resolved number in text beside it for anyone not looking at pixels.
          */
          <span
            aria-hidden="true"
            className="bg-ink absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${Math.min(1, Math.max(0, ghost)) * 100}%` }}
          />
        )}
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className={cn(
          "border-ground bg-ink block size-3.5 rounded-full border-2 shadow-sm",
          "transition-[background-color,box-shadow] duration-150",
          "hover:ring-line focus-visible:ring-line hover:ring-4 focus-visible:ring-4 focus-visible:outline-none",
          // Unpinned axes are shown, not driven: the value is whatever the name
          // produced, and the thumb says so by not looking like a handle you
          // have already set. Dragging it pins it, and it fills in.
          //
          // Read off the root rather than set here, because `data-unpinned` is
          // a prop the *caller* passes and Radix forwards unknown props to the
          // root element only.
          "group-data-[unpinned=true]:bg-muted",
        )}
      />
    </SliderPrimitive.Root>
  );
}
