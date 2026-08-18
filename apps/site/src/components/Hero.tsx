import { useEffect, useRef, useState } from "react";
import { Blobatar } from "sketchy-blobatar/react";
import type { BlobatarOptions } from "sketchy-blobatar";
import {
  bashful,
  excited,
  happy,
  idle,
  mad,
  sad,
  sleepy,
  suspicious,
  type Expression,
} from "sketchy-blobatar/expression";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Snippet } from "@/components/ui/snippet";
import { Install } from "@/components/ui/install";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EggMark, eggFor } from "@/eggs";
import { cn } from "@/lib/utils";

type Bg = "none" | "squircle" | "circle" | "square";

/**
 * Eight stops around the wheel plus an auto chip.
 *
 * `hue` is genuinely tri-state — unset means the seed drives color, which is
 * the library's default and the more interesting behaviour. A bare 0-360 slider
 * has nowhere to express "unset", and implies a precision nobody tuning a
 * landing page wants.
 */
const HUES = [12, 40, 78, 140, 190, 225, 275, 320];

/**
 * The six silhouettes, each as the position in [0, 1) that selects it.
 *
 * Shape is not a named prop — the library exposes it as a pinned *trait*, and a
 * trait value is "the number the hash would have produced". So these are the
 * midpoints of the bands `shapeOf` splits that range into, midpoints rather than
 * edges because the bands are frozen per major but their boundaries are the one
 * place a future retune would land.
 *
 * Like `hue`, this is tri-state: unset means the name picks, which is the
 * default and the more interesting behaviour.
 */
const SHAPES = [
  { name: "round", at: 0.14 },
  { name: "organic", at: 0.43 },
  { name: "boxy", at: 0.65 },
  { name: "nub", at: 0.78 },
  { name: "cloud", at: 0.885 },
  { name: "sun", at: 0.965 },
] as const;

type Shape = (typeof SHAPES)[number];

/**
 * The roster, paired with the identifier you would import to get it.
 *
 * The name is not decoration: it is what the snippet writes into both the
 * import and the prop, so the picker and the generated code cannot drift. That
 * is also why `idle` is in the list rather than being a separate "off" control
 * — it is a real expression with a real export, and it is the one the snippet
 * omits, because omitting `expression` is what `idle` means.
 */
const POSES = [
  { name: "idle", value: idle },
  { name: "happy", value: happy },
  { name: "sad", value: sad },
  { name: "mad", value: mad },
  { name: "sleepy", value: sleepy },
  { name: "excited", value: excited },
  { name: "suspicious", value: suspicious },
  { name: "bashful", value: bashful },
] as const;

type Pose = (typeof POSES)[number];

/**
 * How long a reaction is held before it releases back to the picked pose.
 *
 * Measured from the click, so it *contains* the morph in rather than following
 * it: at 300ms in and 400ms back the face sits at full strength for the
 * remainder, and the click lasts about 2s end to end. Long enough to register
 * as an expression rather than a flicker, short enough that a second click
 * never feels blocked.
 */
const HOLD = 1500;

/**
 * The `lg` breakpoint, read in JS.
 *
 * Which side the tuning panel opens on is a layout decision, and layout
 * decisions belong in CSS — but Radix positions the panel in JS against a
 * measured rect, so there is no class to hand it. Matching the same 1024px
 * the grid switches at keeps the two from disagreeing.
 */
function useWide() {
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return wide;
}

/**
 * JSX attribute strings are not JS strings — no backslash escapes — so a name
 * containing a quote cannot be written as `name="…"` at all. Fall through to an
 * expression container, where the JS literal `JSON.stringify` produces is
 * exactly right.
 */
function attr(value: string) {
  return /["\\]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;
}

function snippet(
  seed: string,
  bg: Bg,
  hue: number | null,
  pose: Pose,
  shape: Shape | null,
  variant: BlobatarOptions["variant"],
) {
  const posed = pose.value !== idle;

  const imports = [`import { Blobatar } from "sketchy-blobatar/react";`];
  if (posed) imports.push(`import { ${pose.name} } from "sketchy-blobatar/expression";`);
  imports.push(`import "sketchy-blobatar/motion.css";`);

  // Only what differs from the defaults. A snippet that restates every default
  // reads as configuration you are obliged to supply, which is the opposite of
  // what a one-prop library wants to advertise.
  const props = [`name=${attr(seed || "blobatar")}`];
  if (shape) props.push(`traits={{ shape: ${shape.at} }}`);
  if (bg !== "none") props.push(`background="${bg}"`);
  if (hue !== null) props.push(`hue={${hue}}`);
  if (variant === "original") props.push(`variant="original"`);
  if (posed) props.push(`expression={${pose.name}}`);
  props.push(`animate="hover"`);

  // The one line here that cannot be read off the code. `0.885` is a position in
  // a range, not a measurement, and nothing about it says "cloud" — so the name
  // goes above the element, where a `//` is legal. Inside the attribute list it
  // would not be: JSX has no line comments between props.
  const note = shape ? [`// shape: ${shape.name}`] : [];

  return [
    imports.join("\n"),
    "",
    ...note,
    `<Blobatar`,
    ...props.map((p) => `  ${p}`),
    `/>`,
  ].join("\n");
}

export function Hero() {
  const [seed, setSeed] = useState("alain00");
  const [bg, setBg] = useState<Bg>("none");
  const [hue, setHue] = useState<number | null>(null);
  const [pose, setPose] = useState<Pose>(POSES[0]);
  const [shape, setShape] = useState<Shape | null>(null);
  const [variant, setVariant] = useState<BlobatarOptions["variant"]>("outlined");

  /**
   * A reaction is a temporary override of the picked pose, not a replacement
   * for it — clicking the big blobatar borrows the face and gives it back. Held
   * separately for exactly that reason: `null` here means "show what the picker
   * says", so the release is a single `setBurst(null)` and the picker never has
   * to be restored to a value it was already holding.
   */
  const [burst, setBurst] = useState<Expression | null>(null);
  const release = useRef<ReturnType<typeof setTimeout>>(null);
  const wide = useWide();

  /**
   * A few names render as themselves instead of as a hash — see `@/eggs`.
   *
   * Only the face is swapped. The panel keeps tuning a real blobatar and the
   * snippet keeps printing the code that produces one, because both are claims
   * about the library and the library has no eggs in it — the same name in a
   * consumer's app renders a blob, and a snippet that implied otherwise would be
   * the one part of this joke that costs somebody an afternoon.
   */
  const egg = eggFor(seed);

  /**
   * A mark has no expression to burst into, so the click gets its own reaction.
   *
   * A flag rather than a timer, unlike `burst`: the animation itself is the
   * duration, and `onAnimationEnd` is a more honest end than a number that has
   * to be kept in sync with the keyframes.
   */
  const [nudge, setNudge] = useState(false);

  useEffect(() => () => clearTimeout(release.current ?? undefined), []);

  const shown = burst ?? pose.value;
  const tuned =
    bg !== "none" ||
    hue !== null ||
    pose.value !== idle ||
    shape !== null ||
    variant === "original";

  /**
   * The burst pattern the library documents: an expression is a latched state,
   * so the consumer owns the timer that puts it back. This is that consumer.
   *
   * Drawn from the pool minus whatever is currently showing, because a click
   * that re-picks the same expression looks like a click that did nothing.
   */
  const react = () => {
    const pool = POSES.filter((p) => p.value !== shown && p.value !== idle);
    setBurst(pool[Math.floor(Math.random() * pool.length)]!.value);
    clearTimeout(release.current ?? undefined);
    release.current = setTimeout(() => setBurst(null), HOLD);
  };

  const pick = (p: Pose) => {
    clearTimeout(release.current ?? undefined);
    setBurst(null);
    setPose(p);
  };

  const opts: BlobatarOptions = {
    background: bg === "none" ? false : bg,
    hue: hue ?? undefined,
    expression: shown,
    variant,
    // Sparse on purpose: pinning `shape` leaves every other trait — eye gap,
    // body ratio, tilt — coming from the name, so picking a cloud still gives
    // you *your* cloud rather than the same cloud everybody else gets.
    traits: shape ? { shape: shape.at } : undefined,
  };

  return (
    /*
      One viewport, two columns. The left column is the toy and the right one is
      the payoff — you tune a face and read the code that produces it, without
      the page moving. Below `lg` they stack in that same order, so the snippet
      lands directly under the thing it describes.
    */
    <section className="relative mx-auto flex min-h-svh max-w-6xl flex-col justify-center gap-14 px-6 py-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-16">
      {/*
        Source and author, in that order — the repo is what the page is selling
        and the profile is who to ask about it.

        Absolute to the hero rather than fixed to the viewport: there is no
        header on this page, so a pair of icons pinned to the window would
        follow you down three more sections with nothing to belong to. Here
        they scroll away with the hero, and `right-6` matches the section's own
        padding so they land on the same edge as the snippet column below.

        Icons rather than labelled links — at this size and this far from the
        content, two words would read as a navigation bar the page does not
        have. The name lives in the tooltip and the accessible label.
      */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-1 lg:top-8">
        <ThemeToggle />
        <SocialLink href="https://github.com/Alain00/blobatar" label="blobatar on GitHub">
          <GitHubIcon />
        </SocialLink>
        <SocialLink href="https://x.com/alain_0012" label="@alain_0012 on X">
          <XIcon />
        </SocialLink>
      </div>

      <div className="flex flex-col items-center gap-10 lg:items-start">
        <div className="w-full">
          <h1 className="text-[clamp(3rem,10vw,7.5rem)] leading-[0.82] font-medium tracking-[-0.055em]">
            blobatar
          </h1>

          <p className="text-muted mt-5 max-w-md text-balance text-base leading-relaxed">
            Deterministic outlined blobatars from any string. No dependencies,
            about 4&nbsp;KB.
          </p>
        </div>

        {/*
          Question and answer are one unit, so they sit closer to each other
          than either does to the wordmark above them. Equal gaps read as three
          unrelated blocks; this reads as a sentence with its reply.

          The popover root spans both, because the panel is anchored to the
          face rather than to the button that opens it — see the anchor below.
        */}
        <Popover>
          <div className="flex w-full flex-col items-center gap-6 lg:items-start">
            {/*
              A sentence, not a form. The question is the label — literally, via
              `htmlFor`, so clicking it focuses the field — and the field is a
              dashed blank inside it, sized to whatever you have typed. That is the
              one line of the page that has to say "this is about you", and a boxed
              input with a placeholder says "this is about data entry".

              The field is still a real `<input>`: contenteditable would have cost
              the caret, the mobile keyboard, autofill suppression and undo, and
              bought nothing a grid cell cannot do.
            */}
            <div className="flex w-full max-w-md flex-wrap items-baseline justify-center gap-x-3 gap-y-2 text-xl sm:text-2xl lg:justify-start">
              {/*
                An invitation, not an interrogation. "And your name is?"
                collects a field; this proposes doing something together, and
                names the thing you get at the end of it — which is also the
                only place on the page that says a blobatar is *yours*.
              */}
              <label htmlFor="seed" className="text-muted cursor-text tracking-tight">
                Let’s find your blobatar
              </label>

              {/*
                Two elements in one grid cell: the input, and an invisible copy of
                what it holds. The copy is what has width, so the blank grows and
                shrinks with the name instead of reserving a fixed run of dashes.
                `whitespace-pre` keeps a trailing space measurable — without it the
                caret walks off the end of the underline.
              */}
              <span
                className={cn(
                  "inline-grid border-b border-dashed pb-1 transition-colors duration-200",
                  // The dashed rule is the entire affordance now — there is no box
                  // and no caret until you are in it — so it has to answer a
                  // hovering pointer. Three states: at rest, under the pointer,
                  // and focused.
                  "border-line hover:border-muted focus-within:border-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className="col-start-1 row-start-1 px-1 whitespace-pre invisible tracking-tight"
                >
                  {seed || "someone"}
                </span>
                <input
                  id="seed"
                  value={seed}
                  // The nudge is cleared on every keystroke rather than only on
                  // the ones that change which mark is showing: a flag left set
                  // from a previous name lands the click reaction on the reveal
                  // of the next one, and the two transforms fight.
                  onChange={(e) => {
                    setSeed(e.target.value);
                    setNudge(false);
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="someone"
                  // `size={1}`, and it is load-bearing. Both elements share one
                  // grid cell, so the column is as wide as the widest of them —
                  // and an input's default intrinsic width is about 20 characters,
                  // which is what would set the width instead of the name. Sized
                  // to one character it contributes nothing and `w-full` stretches
                  // it back over the measured copy.
                  size={1}
                  className={cn(
                    "col-start-1 row-start-1 w-full min-w-0 bg-transparent px-1 text-center",
                    "tracking-tight outline-none",
                    "placeholder:text-muted/40",
                  )}
                />
              </span>

              <PopoverTrigger
                  aria-label="Blobatar options"
                  className={cn(
                    "text-muted hover:text-ink hover:bg-line/50 -mb-1 self-center rounded-lg p-1.5",
                    "transition-colors duration-150",
                    // Two states worth showing on a control that hides everything
                    // behind it: open, because the panel is portalled and the
                    // button would otherwise look untouched while it hangs off
                    // it; and tuned, because a closed panel is the only place the
                    // page says that this blobatar is no longer the default one.
                    "data-[state=open]:text-ink data-[state=open]:bg-line/50",
                    tuned && "text-ink",
                  )}
                >
                <SlidersIcon />
              </PopoverTrigger>
            </div>

            {/*
              Below the question, because that is the order it happens in: you are
              asked, you answer, the face is what comes back. With the blobatar above
              the input the page showed you the answer before it had asked, which
              is what made the column read as three unrelated things stacked.

              `animate="always"` puts this on the inline-SVG path — roughly a dozen
              DOM nodes instead of one <img>. That is the trade the library
              documents, and a single hero blobatar is exactly the case it is meant
              for.

              A real button, not a click handler on the SVG. The blobatar keeps its
              own `role="img"` and name — the expression is decorative and
              deliberately invisible to assistive tech — so the button is what
              carries the action, and its label describes what clicking *does*
              rather than what the face is currently doing.

              It is also the popover's anchor. A panel that positions itself off
              the little icon has to open *somewhere* relative to a point inside
              the sentence, and every direction from there crosses the blobatar at
              one width or another — which is fatal for a control surface whose
              whole job is changing what the blobatar looks like. Anchored to the
              face instead, "beside it" and "under it" are directions that mean
              what they say.
            */}
            <PopoverAnchor asChild>
              <button
                type="button"
                onClick={egg ? () => setNudge(true) : react}
                aria-label={egg ? "Nudge" : "React"}
                className="rounded-full"
              >
                {/*
                  Same slot, same size class, either way — the sentence above it
                  and the snippet beside it must not move when a mark takes the
                  face's place, or the egg stops being a surprise and becomes a
                  layout shift.

                  Keyed on which name matched, so typing your way from one egg to
                  another remounts and replays the reveal — a different creature
                  arriving, rather than the same one changing colour.
                */}
                {egg ? (
                  <EggMark
                    key={egg.id}
                    egg={egg}
                    title={seed.trim()}
                    nudge={nudge}
                    onSettled={() => setNudge(false)}
                    className="size-[min(26vmin,13rem)]"
                  />
                ) : (
                  <Blobatar
                    name={seed || " "}
                    animate="always"
                    {...opts}
                    title={`Blobatar for ${seed}`}
                    // `hero-blobatar` is a hook for one rule in `styles.css`, which
                    // gives this blobatar back the pointer reaction the page turns
                    // off everywhere else.
                    className="hero-blobatar size-[min(26vmin,13rem)]"
                  />
                )}
              </button>
            </PopoverAnchor>

            {/*
              Beside the face on a wide screen, where the gap between the columns
              is empty; under it on a narrow one, where nothing is beside it and
              the only thing worth covering is the snippet. Both are measured
              from the blobatar, so neither lands on top of it.
            */}
            <PopoverContent
              side={wide ? "right" : "bottom"}
              align={wide ? "start" : "center"}
              sideOffset={wide ? 28 : 20}
              collisionPadding={16}
              // Seven shape tiles made this panel tall enough to outgrow a
              // short window. Radix measures the space it actually has and
              // publishes it as a custom property; capping to that turns an
              // overflow into a scroll instead of a clipped hue row.
              className="max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto"
            >
              <div className="flex flex-col gap-5">
                <Field label="version">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-muted flex justify-between font-mono text-[0.65rem] lowercase">
                      <span>original</span>
                      <span>outlined</span>
                    </div>
                    <Slider
                      aria-label="Blobatar version"
                      aria-valuetext={
                        variant === "original" ? "Original filled style" : "Outlined style"
                      }
                      min={0}
                      max={1}
                      step={1}
                      value={[variant === "original" ? 0 : 1]}
                      onValueChange={([value]) => setVariant(value === 0 ? "original" : "outlined")}
                    />
                  </div>
                </Field>

                {/*
                  Shape first: it is the trait that decides what creature this
                  is, and every control under it decorates that decision.

                  Same argument as the expression row for showing the thing
                  rather than naming it — "nub" and "organic" are words for
                  silhouettes nobody has seen yet. Seeded with the current name,
                  so the row is six versions of *your* blobatar.
                */}
                <Field label="shape">
                  <div className="grid grid-cols-4 gap-1" role="group" aria-label="Shape">
                    {/*
                      `auto` is a tile rather than a pill because it is a
                      seventh option of the same kind — it shows the blobatar
                      the name produces on its own, which is exactly what
                      picking it gives you back.
                    */}
                    <ShapeTile
                      label="auto"
                      seed={seed}
                      opts={{ ...opts, traits: undefined }}
                      selected={shape === null}
                      onClick={() => setShape(null)}
                    />
                    {SHAPES.map((s) => (
                      <ShapeTile
                        key={s.name}
                        label={s.name}
                        seed={seed}
                        opts={{ ...opts, traits: { shape: s.at } }}
                        selected={shape?.name === s.name}
                        onClick={() => setShape(s)}
                      />
                    ))}
                  </div>
                </Field>

                {/*
                  The expression picker is the same blobatar wearing each pose,
                  not a select. A pose is a *look*, and the only honest label
                  for a look is the look — "mad" on two dot eyes means
                  nothing until you have seen it. Seeded identically to the
                  hero, so the grid reads as one creature's range rather than
                  a set of strangers.
                */}
                <Field label="mood">
                  <div className="grid grid-cols-4 gap-1" role="group" aria-label="Mood">
                    {POSES.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => pick(p)}
                        aria-pressed={pose.name === p.name}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors duration-150",
                          pose.name === p.name ? "bg-line/70" : "hover:bg-line/30",
                        )}
                      >
                        {/*
                          Static `<img>`s, deliberately. A pose renders without
                          `animate` — that is the library's own claim — and four
                          live SVG trees inside a panel would be four things
                          competing with the one that is supposed to be moving.
                        */}
                        <Blobatar
                          name={seed || " "}
                          {...opts}
                          expression={p.value}
                          alt=""
                          className="size-10"
                        />
                        <span
                          className={cn(
                            "font-mono text-[0.65rem] lowercase transition-colors",
                            pose.name === p.name ? "text-ink" : "text-muted",
                          )}
                        >
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="background">
                  <Segmented
                    type="single"
                    value={bg}
                    onValueChange={(v) => v && setBg(v as Bg)}
                    aria-label="Background"
                  >
                    {/*
                      Tighter than the default: four options have to fit the
                      panel's width on one pill, and a pill that wraps stops
                      being one.
                    */}
                    <SegmentedItem value="none" className="px-3">
                      none
                    </SegmentedItem>
                    <SegmentedItem value="squircle" className="px-3">
                      squircle
                    </SegmentedItem>
                    <SegmentedItem value="circle" className="px-3">
                      circle
                    </SegmentedItem>
                    <SegmentedItem value="square" className="px-3">
                      square
                    </SegmentedItem>
                  </Segmented>
                </Field>

                <Field label="hue">
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-label="Hue"
                  >
                    <button
                      onClick={() => setHue(null)}
                      aria-pressed={hue === null}
                      className={cn(
                        "border-line rounded-full border px-2.5 py-0.5 text-[0.7rem] lowercase transition-colors",
                        hue === null
                          ? "bg-ink text-ground border-ink"
                          : "text-muted hover:text-ink",
                      )}
                    >
                      auto
                    </button>
                    {HUES.map((h) => (
                      <button
                        key={h}
                        onClick={() => setHue(h)}
                        aria-label={`Hue ${h} degrees`}
                        aria-pressed={hue === h}
                        style={{ background: `oklch(0.72 0.15 ${h})` }}
                        className={cn(
                          "size-5 rounded-full transition-transform duration-150",
                          hue === h
                            ? "ring-ink ring-offset-raised scale-110 ring-2 ring-offset-2"
                            : "hover:scale-110",
                        )}
                      />
                    ))}
                  </div>
                </Field>
              </div>
            </PopoverContent>
          </div>
        </Popover>
      </div>

      {/*
        The snippet is the whole argument of the page: whatever you just tuned
        is four lines you can paste. It regenerates on every control, so there
        is never a step where you have to work out which prop you changed.
      */}
      <div className="flex w-full flex-col gap-6">
        {/*
          Directly above the snippet, because the two are one instruction in the
          order you carry it out: install the package, then paste the code that
          imports it. It used to sit in the closing section — past a viewport of
          hero and two of wall — which put the page's only call to action behind
          the entire page.

          `self-start` is load-bearing: a flex column stretches its children, and
          a command pill as wide as the snippet stops reading as a thing you
          press.
        */}
        <Install command="bun add sketchy-blobatar" className="self-start" />

        <div className="flex flex-col gap-3">
          <div className="text-muted flex items-baseline justify-between text-xs lowercase">
            <span>your config</span>
            <span className="font-mono normal-case">Blobatar.tsx</span>
          </div>
          <Snippet code={snippet(seed, bg, hue, pose, shape, variant)} />
          <p className="text-muted text-xs leading-relaxed">
            Every prop is optional except the name. Drop{" "}
            <code className="font-mono">animate</code> and the blobatar renders as a
            single <code className="font-mono">&lt;img&gt;</code>.
          </p>

          {/*
            A plain anchor to a plain second document, which is the whole reason
            it costs nothing: no router, no prefetch, no editor code in this
            bundle. The panel above is four axes and this page is not the place
            for twenty, so the link is where the four run out.
          */}
          <a
            href="/editor"
            className="text-muted hover:text-ink group inline-flex w-fit items-center gap-1.5 text-xs transition-colors"
          >
            Tune every trait in the editor
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * One silhouette, rendered as itself.
 *
 * Static `<img>`s, deliberately — same trade the expression row makes: seven
 * live SVG trees inside a panel would be seven things competing with the one
 * that is supposed to be moving. The options spread in carry whatever else is
 * currently tuned, so the row restyles as you change hue or pose rather than
 * showing six blobatars from a different configuration.
 */
function ShapeTile({
  label,
  seed,
  opts,
  selected,
  onClick,
}: {
  label: string;
  seed: string;
  opts: BlobatarOptions;
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
      <Blobatar name={seed || " "} {...opts} alt="" className="size-9" />
      <span
        className={cn(
          "font-mono text-[0.65rem] lowercase transition-colors",
          selected ? "text-ink" : "text-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted text-[0.7rem] tracking-wide lowercase">{label}</span>
      {children}
    </div>
  );
}

/**
 * Shaped like the options trigger on purpose — same padding, radius and hover
 * wash. They are the only three icon-only controls on the page, and two of them
 * sitting in the same column with different hit areas reads as an accident.
 */
function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        // `-mr-1.5` on the row's last child cancels the icon padding, so the
        // marks themselves sit flush with the section edge instead of floating
        // 6px inside it. Harmless on the first one.
        "text-muted hover:text-ink hover:bg-line/50 rounded-lg p-1.5 last:-mr-1.5",
        "transition-colors duration-150",
      )}
    >
      {children}
    </a>
  );
}

/**
 * Both marks are solid `fill`, not strokes like the rest of the page's icons —
 * these are wordmarks with fixed geometry, and redrawing them as 1.7px outlines
 * would make them not-quite-GitHub and not-quite-X.
 */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-[1.15rem]">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-[1.05rem]">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className="size-[1.15rem]"
    >
      <path d="M4 8h8M17 8h3M4 16h3M12 16h8" />
      <circle cx="14.5" cy="8" r="2.2" />
      <circle cx="9.5" cy="16" r="2.2" />
    </svg>
  );
}
