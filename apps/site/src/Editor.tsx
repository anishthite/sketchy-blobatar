import { useMemo, useState } from "react";
import { Blobatar } from "sketchy-blobatar/react";
import { traits as reader } from "sketchy-blobatar";
import { Control } from "@/components/editor/control";
import { ShapePicker, TonePicker } from "@/components/editor/pickers";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Snippet } from "@/components/ui/snippet";
import { Install } from "@/components/ui/install";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AXES, GROUPS, applies, round3, type Axis, type Group, type Shape } from "@/editor/axes";
import { blobLayout, resolved } from "@/editor/resolved";
import { snippet, type Api, type Motion } from "@/editor/snippet";
import { NAMES } from "@/names";
import { cn } from "@/lib/utils";

/**
 * The editor.
 *
 * Its own document, not a route on the landing page — see `build.ts`. The
 * bundle here carries a slider, twenty controls and a live layout readback,
 * none of which the landing page has any use for, and that page's first paint
 * is already the thing its whole build is tuned around.
 *
 * **The snippet is the deliverable.** The tuned blobatar is the demonstration;
 * the code underneath is what you leave with, and every trade between the two
 * goes to the code. That is why the readouts are raw trait positions rather
 * than friendly units, why the name is emitted literally, and why pinning —
 * the thing that decides what appears in the snippet — is the only piece of
 * interaction state on the page.
 *
 * One state shape carries all of it: `pinned` is simultaneously the UI's notion
 * of which axes you have taken control of, the `traits` map handed to the
 * library, and the object literal in the generated code. They cannot drift,
 * because they are the same object.
 */
export function Editor() {
  const [name, setName] = useState("sketchy");
  const [pinned, setPinned] = useState<Record<string, number>>({});
  const [api, setApi] = useState<Api>("react");
  const [motion, setMotion] = useState<Motion>("hover");

  /**
   * Every trait's current position, pinned or hashed — the same reader the
   * library builds internally, over the same name and the same overrides.
   *
   * This is what lets an unpinned slider show where it actually sits instead of
   * sitting at zero waiting to be told. Without it the panel would open as an
   * empty form in front of a blobatar it claims to describe.
   */
  const t = useMemo(() => reader(name, true, pinned), [name, pinned]);

  // The resolved geometry, for the two things only it can answer: which
  // silhouette the name produced when `shape` is unpinned, and where the eye
  // cluster ended up when `fit` scaled it.
  const layout = useMemo(() => blobLayout(name || " ", pinned), [name, pinned]);
  const shape = layout.shape as Shape;
  const ghosts = useMemo(() => resolved(layout, t), [layout, t]);

  const pin = (key: string, v: number) =>
    setPinned(p => ({ ...p, [key]: round3(v) }));

  /** The pickers' `auto` chip, which is always a removal rather than a toggle. */
  const unpin = (key: string) =>
    setPinned(({ [key]: _gone, ...rest }) => rest);

  const toggle = (key: string) =>
    setPinned(p => {
      if (key in p) {
        const { [key]: _gone, ...rest } = p;
        return rest;
      }
      // Snapped on the way in, not on the way out. The hashed value has full
      // float precision and the snippet emits three decimals — pinning the
      // rounded number is what keeps the preview and the generated code driven
      // by the identical value. See `round3`.
      return { ...p, [key]: round3(t(key)) };
    });

  /**
   * Re-roll everything unpinned, by changing the name.
   *
   * The alternative — rolling each unpinned trait independently — was the other
   * half of the spec's open question, and this is the one that produces
   * blobatars that look designed: a name moves every unpinned axis *together*,
   * through the same hash the library ships, so what comes back is a blobatar
   * somebody could actually have. Independent rolls produce the average of the
   * space, which is a lumpy pebble with mismatched eyes, over and over.
   */
  const shuffle = () =>
    setName(prev => {
      let next = prev;
      while (next === prev) {
        const base = NAMES[Math.floor(Math.random() * NAMES.length)]!;
        next = Math.random() < 0.5 ? base : `${base}${Math.floor(Math.random() * 90) + 10}`;
      }
      return next;
    });

  const count = Object.keys(pinned).length;
  const code = snippet({ api, name, pinned, motion });

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24">
      <header className="flex items-center justify-between gap-4 py-6">
        <a
          href="/"
          className="text-muted hover:text-ink group flex items-baseline gap-2 text-sm transition-colors"
        >
          <span className="group-hover:-translate-x-0.5 inline-block transition-transform">←</span>
          Sketchy Blobatar
        </a>
        <div className="flex items-center gap-2">
          <span className="text-muted font-mono text-xs lowercase">editor</span>
          <ThemeToggle />
        </div>
      </header>

      {/*
        Three blocks, placed rather than nested, because their order is not the
        same on both layouts.

        Wide: the blobatar and the code it produces stack in one column with the
        panel beside them, so nothing you drag moves the thing you are looking
        at, and the snippet is in view the whole time you are tuning.

        Narrow: nothing can be beside anything, so the order becomes preview,
        panel, snippet — controls before code. The alternative puts a twelve-line
        snippet between the blobatar and the sliders, which on a phone means
        scrolling past the output to reach the input and back again to see what
        it did. The snippet lands last because it is where you finish.
      */}
      <div
        className={cn(
          "grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-x-14 lg:gap-y-8",
          // `auto` then `1fr`, and it is load-bearing: the panel spans both rows
          // and is a screen tall, so with default row sizing that height gets
          // shared between them and the snippet drifts half a screen below the
          // blobatar it describes. Sizing the first row to the preview puts them
          // back together and gives the slack to the row that has nothing under
          // it.
          "lg:grid-rows-[auto_1fr]",
        )}
      >
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Preview
            name={name}
            setName={setName}
            pinned={pinned}
            motion={motion}
            setMotion={setMotion}
            onShuffle={shuffle}
          />
        </div>

        {/*
          `order-3` rather than a different DOM order, so the wide layout — where
          this reads directly under the blobatar it describes — keeps focus order
          matching what is on screen. The cost lands on narrow, where the snippet
          is announced before the panel it is visually below. Both are one swipe
          apart either way.
        */}
        {/*
          `min-w-0`, and it is not decoration: a grid item's automatic minimum
          size is its *content's* width, and the snippet's longest line is a
          hundred characters of import. Without it the column refuses to be
          narrower than that line, the page grows wider than the phone it is on,
          and everything above scrolls sideways — with the `overflow-x-auto` on
          the code block never getting a chance to do its job.
        */}
        <div className="order-3 flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
          <div className="text-muted flex items-baseline justify-between gap-4 text-xs lowercase">
            <span>your config</span>
            <Segmented
              type="single"
              value={api}
              onValueChange={(v: string) => v && setApi(v as Api)}
              aria-label="API"
            >
              <SegmentedItem value="react">react</SegmentedItem>
              <SegmentedItem value="string">string</SegmentedItem>
            </Segmented>
          </div>

          <Snippet code={code} />

          <p className="text-muted text-xs leading-relaxed">
            {count === 0
              ? "Nothing is pinned, so this Sketchy Blobatar is entirely the name — which is the default, and usually the right one. Pin an axis to fix it for everybody."
              : `${count} pinned ${count === 1 ? "axis is" : "axes are"} fixed for every name; everything else still comes from the one you pass.`}
          </p>

          <Install command="bun add sketchy-blobatar" className="mt-2 self-start" />
        </div>

        {/*
          Its own scroll on a wide screen, so the preview and the snippet stay
          put while you work down the panel — the whole argument for the two
          columns is that the thing you are tuning never moves.
        */}
        <div
          className={cn(
            "border-line bg-raised/60 order-2 flex min-w-0 flex-col gap-6 rounded-2xl border p-5",
            "lg:col-start-2 lg:row-span-2 lg:row-start-1",
            "lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:overflow-y-auto",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted text-xs lowercase">
              {count === 0 ? "nothing pinned" : `${count} pinned`}
            </span>
            <button
              type="button"
              onClick={() => setPinned({})}
              disabled={count === 0}
              className={cn(
                "text-muted hover:text-ink hover:bg-line/50 rounded-lg px-2.5 py-1 text-xs lowercase",
                "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-30",
              )}
            >
              unpin all
            </button>
          </div>

          {GROUPS.map(group => (
            <GroupBlock
              key={group}
              group={group}
              shape={shape}
              name={name}
              pinned={pinned}
              hue={t("hue") * 360}
              value={key => (key in pinned ? pinned[key]! : t(key))}
              ghost={key => ghosts[key]}
              onChange={pin}
              onPin={toggle}
              onUnpin={unpin}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function Preview({
  name,
  setName,
  pinned,
  motion,
  setMotion,
  onShuffle,
}: {
  name: string;
  setName: (v: string) => void;
  pinned: Record<string, number>;
  motion: Motion;
  setMotion: (m: Motion) => void;
  onShuffle: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/*
        The hero's dashed blank, at panel scale. Same argument: a boxed input
        with a placeholder says "data entry", and this is the one field on the
        page that stands for a person. The invisible copy underneath is what
        carries the width, so the rule grows with what you type.
      */}
      <div className="flex w-full items-baseline justify-center gap-3 text-lg">
        <label htmlFor="editor-name" className="text-muted cursor-text lowercase">
          name
        </label>
        <span className="border-line hover:border-muted focus-within:border-ink inline-grid border-b border-dashed pb-1 transition-colors duration-200">
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 px-1 tracking-tight whitespace-pre"
          >
            {name || "someone"}
          </span>
          <input
            id="editor-name"
            value={name}
            onChange={e => setName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="someone"
            size={1}
            className="col-start-1 row-start-1 w-full min-w-0 bg-transparent px-1 text-center tracking-tight outline-none placeholder:text-muted/40"
          />
        </span>
        <button
          type="button"
          onClick={onShuffle}
          aria-label="Shuffle — re-rolls every unpinned axis"
          title="Shuffle — re-rolls every unpinned axis"
          className="text-muted hover:text-ink hover:bg-line/50 -mb-1 self-center rounded-lg p-1.5 transition-colors duration-150"
        >
          <ShuffleIcon />
        </button>
      </div>

      {/*
        Two elements rather than one with a variable `animate`, and the union in
        `BlobatarProps` is why: a static blobatar is an `<img>` and an animated
        one is inline SVG, so `alt` and `onLoad` stop meaning anything the
        moment motion is on. The library types that as a discriminated union
        precisely so this is a compile error rather than a dead prop.
      */}
      {motion ? (
        <Blobatar
          name={name || " "}
          traits={pinned}
          animate={motion}
          title={`Sketchy Blobatar for ${name}`}
          className="editor-preview size-[min(34vmin,15rem)]"
        />
      ) : (
        <Blobatar
          name={name || " "}
          traits={pinned}
          alt={`Sketchy Blobatar for ${name}`}
          className="size-[min(34vmin,15rem)]"
        />
      )}

      <div className="flex items-center gap-3">
        <span className="text-muted text-xs lowercase">motion</span>
        <Segmented
          type="single"
          value={motion === false ? "none" : motion}
          onValueChange={(v: string) =>
            v && setMotion(v === "none" ? false : (v as Motion))
          }
          aria-label="Motion"
        >
          <SegmentedItem value="none">none</SegmentedItem>
          <SegmentedItem value="hover">hover</SegmentedItem>
          <SegmentedItem value="always">always</SegmentedItem>
        </Segmented>
      </div>
    </div>
  );
}

interface GroupProps {
  group: Group;
  shape: Shape;
  name: string;
  pinned: Record<string, number>;
  hue: number;
  value: (key: string) => number;
  ghost: (key: string) => number | undefined;
  onChange: (key: string, v: number) => void;
  onPin: (key: string) => void;
  onUnpin: (key: string) => void;
}

function GroupBlock({
  group,
  shape,
  name,
  pinned,
  hue,
  value,
  ghost,
  onChange,
  onPin,
  onUnpin,
}: GroupProps) {
  const all = AXES.filter(a => a.group === group);
  const live = all.filter(a => applies(a, shape));
  const missing = all.filter(a => !applies(a, shape));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted border-line border-b pb-2 text-[0.7rem] tracking-wide lowercase">
        {group}
      </h2>

      {live.map(axis =>
        axis.kind === "shape" ? (
          <ShapePicker
            key={axis.key}
            name={name}
            traits={pinned}
            value={pinned.shape}
            onPick={at => (at === null ? onUnpin("shape") : onChange("shape", at))}
          />
        ) : axis.kind === "tone" ? (
          <TonePicker
            key={axis.key}
            hue={hue}
            value={pinned.tone}
            onPick={at => (at === null ? onUnpin("tone") : onChange("tone", at))}
          />
        ) : (
          <Control
            key={axis.key}
            axis={axis}
            value={value(axis.key)}
            pinned={axis.key in pinned}
            ghost={ghost(axis.key)}
            onChange={v => onChange(axis.key, v)}
            onPin={() => onPin(axis.key)}
          />
        ),
      )}

      {/*
        Why the panel is shorter than it was a moment ago.

        A control that does nothing is worse than a control that is not there,
        and a control that vanishes with no explanation is worse than both. One
        line per family of missing axes covers the tilt slider and the three
        decoration sets with the same sentence.
      */}
      {conditions(missing).map(([when, axes]) => (
        <p key={when} className="text-muted/60 text-[0.7rem] leading-relaxed lowercase">
          {axes.map(a => a.label).join(", ")} — {when} only
          {/*
            A pin outlives the silhouette it was made on: switching from sun to
            nub leaves `sun.n` pinned, and it stays in the snippet because
            throwing away something you set is worse than carrying something
            inert — a sparse override on a key the layout never reads changes
            nothing. But it is in your code, so it is said out loud here rather
            than discovered in a diff.
          */}
          {axes.some(a => a.key in pinned) && " · still pinned, still in the snippet"}
        </p>
      ))}
    </section>
  );
}

/** Missing axes, grouped by the silhouettes they need. */
function conditions(missing: Axis[]) {
  const by = new Map<string, Axis[]>();
  for (const a of missing) {
    const when = a.when!.join("/");
    by.set(when, [...(by.get(when) ?? []), a]);
  }
  return [...by];
}

/**
 * Two arrows crossing, the standard shuffle mark. Same 1.7px outline as the
 * rest of the page's icons — see the hero's `SlidersIcon`.
 */
function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-[1.05rem]"
    >
      <path d="M3 7h3.5l3 5m0 0 3 5H16M3 17h3.5l3-5" />
      <path d="M16 4.5 19.5 7 16 9.5M16 14.5 19.5 17 16 19.5" />
      <path d="M13 7h3.5M13 17h3.5" />
    </svg>
  );
}
