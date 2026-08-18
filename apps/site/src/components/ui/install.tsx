import { CheckIcon, CopyIcon, useCopy } from "@/components/ui/copy";
import { cn } from "@/lib/utils";

/**
 * The install command.
 *
 * The whole pill is the button, not an icon parked at one end of it. Nobody
 * reads `bun add sketchy-blobatar` to learn it — they read it to take it — so the
 * target should be the thing they are looking at rather than a 16px square
 * beside it. The icon stays as the affordance that says this is takeable.
 *
 * The `$` is inside the button but outside the copied text: it is what marks
 * the line as a shell command, and it is also the one character that breaks
 * the paste if it comes along.
 */
export function Install({ command, className }: { command: string; className?: string }) {
  const { copied, copy } = useCopy(command);

  return (
    <button
      type="button"
      onClick={copy}
      // The label is what changes, not just the icon: "copied" has to reach a
      // screen reader too, and swapping the accessible name is how that gets
      // announced without a live region.
      aria-label={copied ? "Copied" : `Copy: ${command}`}
      className={cn(
        "group border-line bg-raised/60 inline-flex items-center gap-3 rounded-xl border",
        "py-2.5 pr-3 pl-4 font-mono text-sm",
        "hover:border-muted/50 hover:bg-raised transition-colors duration-150",
        className,
      )}
    >
      <span className="text-muted select-none" aria-hidden="true">
        $
      </span>
      <span>{command}</span>
      <span
        className={cn(
          "text-muted group-hover:text-ink transition-colors duration-150",
          copied && "text-ink",
        )}
        aria-hidden="true"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}
