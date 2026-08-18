import { Blobatar } from "sketchy-blobatar/react";
import { cn } from "@/lib/utils";

/**
 * Overlapping avatars with an overflow count — shadcn's AvatarGroup, except the
 * fallback problem it exists to solve does not exist here. There is no image to
 * fail and no initials to fall back to: a blobatar is the fallback, which is
 * why this is twenty lines rather than a component per layer.
 *
 * `background="circle"` and the ring are one decision. Blobatars are
 * transparent-backdrop silhouettes, so overlapping them directly merges two
 * blobs into one shape; a solid disc separated from the disc behind it by a
 * ring in the surface colour is what makes the stack read as a stack. That ring
 * is also why the card this sits in is a solid `bg-raised` — against the
 * translucent default the rings would be a shade off the panel behind them.
 */
export function Facepile({
  names,
  extra,
  className,
}: {
  names: string[];
  extra?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      {names.map((name) => (
        <Blobatar
          key={name}
          name={name}
          background="circle"
          // Decorative twice over: the header already names the channel, and
          // these faces are a count rendered as pictures.
          alt=""
          className="ring-raised -ml-2 size-7 rounded-full ring-2 first:ml-0"
        />
      ))}
      {extra ? (
        <span className="bg-line text-muted ring-raised -ml-2 grid size-7 place-items-center rounded-full font-mono text-[0.6rem] ring-2">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
