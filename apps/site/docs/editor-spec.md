# Editor spec

Build the page where someone tunes a blobatar by hand and leaves with the code
that reproduces it.

The library side is finished and shipped — `traits` is a real option, tested and
budgeted. This is entirely an `apps/site` job. Nothing here should require a
change to `packages/sketchy-blobatar`; if you find one, that is a finding worth raising
rather than a change to make quietly, because the package's ranges are frozen per
major and its size gate is tight.

Read `docs/adr/0003-configuration-as-trait-overrides.md` first. It is short, and
it explains why the API is shaped the way it is — which is most of what makes the
editor's constraints make sense rather than feel arbitrary.

## What it is

A control panel next to a large live blobatar. You move things, the blobatar changes,
and a snippet underneath stays in step. Copy the snippet, paste it into your app,
get exactly the blobatar you were looking at.

**The snippet is the deliverable, not the blobatar.** The page's argument is "you
can own this look" — the tuned blobatar on screen is the demonstration, the code is
the thing you leave with. Every design decision that trades one against the other
should favour the snippet.

## What already exists

The site is not a blank page, and the editor is a bigger sibling of something
already on it.

`src/components/Hero.tsx` (487 lines) has a working tuning panel: segmented
controls for variant, background, hue and expression, driving a live `<Blobatar>`,
with a generated snippet below. **Read its `snippet()` function at line 88 before
writing anything** — the editor's generator is the same idea with more axes, and
the comment there explains the one rule that matters: emit only what differs from
the defaults, because a snippet restating every default reads as configuration
you are obliged to supply.

Reusable as-is:

- `src/components/ui/snippet.tsx` — `<Snippet code={...} />`. Copy button,
  clipboard handling, and a small closed-grammar highlighter. It handles the JSX
  the Hero emits; **the editor emits an object literal with quoted keys and
  numbers, which that grammar does not tokenize.** Extending `TOKEN` is expected
  — read the alternation-order comment before you touch it.
- `src/components/ui/segmented.tsx` — single-select segmented control (Radix
  ToggleGroup). Right for shape selection and any other exclusive axis.
- `src/components/ui/popover.tsx`, `src/lib/utils.ts` (`cn`).
- Design tokens in `styles.css` — `ground`, `raised`, `ink`, `muted`, `line`,
  `code-str`, `code-key`. Dark-only, and the site is dark-only on purpose.

**There is no slider primitive.** You will need one, and it is the main new UI
component. `@radix-ui/react-slider` is consistent with what is already here
(Radix + shadcn idiom, already two Radix packages in `package.json`).

Where the page lives — a route, a section below the Wall, a replacement for the
Hero's panel — is yours. `server.ts` currently serves `/*` to one `index.html`,
so a route needs a client-side decision, not a server change.

## The API it drives

```tsx
import { Blobatar } from "sketchy-blobatar/react";

<Blobatar name={name} traits={overrides} animate="hover" />;
```

Three things about this that will cost you time if you learn them the hard way:

**The React prop is `name`, not `seed`.** The string API takes `seed`. Same value,
passed straight through; the words differ because they are read in different
positions. See CONTEXT.md's Name/Seed entries. Get this wrong in the generated
snippet and you ship code that does not compile.

**`traits` is `Record<string, number>`, values in `[0, 1)`.** Each is the position
the hash would otherwise have produced. Not viewBox units, not degrees, not
pixels. Sparse — keys you omit still come from the name.

**Values are clamped, not validated.** Out-of-range, `NaN` and `Infinity` all
resolve to something renderable rather than throwing. You cannot crash the
library with a bad number, so you do not need defensive code around the sliders.

### Reading back what actually happened

```ts
import { _layout } from "sketchy-blobatar";
const l = _layout(name, { traits });
```

Returns the resolved geometry and palette. **You need this, and the reason is the
one non-obvious thing in the whole spec.**

The layout runs in full over a configured blobatar — every containment guarantee
still applies. So when a caller asks for the largest eyes *and* the widest gap,
`fit` scales the whole eye cluster down to keep it inside the body. The blobatar
stays correct, but the slider stops doing anything near its top, and an
unexplained dead zone at the end of a slider reads as a broken control.

Read the resolved value back and show it — a ghost mark on the track, a dimmed
numeric readout, something. This is what turns "this slider is broken" into "I am
at the limit of what fits."

`_layout` returns a union across variants; `shape` is the discriminating member.
`test/traits.test.ts` has a `blobLayout` narrowing helper you can copy.

## The control set

**Do not build forty sliders.** The encoding is complete and dumb by design; the
editor is curated and small. That split is in the ADR, and it is the difference
between a tool and a settings dump.

A macro control writes several trait keys from one value. That is expected and
correct — it is exactly the opinionated mapping the library refuses to hold,
because it will be retuned often and the library's ranges cannot be.

Proposed starting set. Prune it — a third of these will feel useless once you can
actually drag them, and finding that out is part of the job:

| Control            | Writes                                            |
| ------------------ | ------------------------------------------------- |
| Shape              | `shape` (6 buttons, band midpoints)               |
| Body size          | `body.r`                                          |
| Body proportion    | `body.ratio`                                      |
| Squareness         | `body.n`                                          |
| Tilt               | `body.rot` — **boxy only**                        |
| Lumpiness          | `body.r0`–`body.r7` + `body.pts` — macro          |
| Eye size           | `eye.rx`                                          |
| Eye shape          | `eye.ratio` (round ↔ capsule)                     |
| Eye squareness     | `eye.n`                                           |
| Eye separation     | `eye.gap`                                         |
| Eye lean           | `eye.lean`                                        |
| Asymmetry          | `eye.scale`, `eye.stretch`, `eye.lean2`, `eye.dy` — macro |
| Gaze               | `gaze.x`, `gaze.y`                                |
| Hue / Tone         | `hue`, `tone` — see precedence note below         |
| Decoration         | shape-conditional — see below                     |

The six shape band midpoints are pinned in
`packages/sketchy-blobatar/test/traits.test.ts` under "every shape in the vocabulary is
reachable by band midpoint". **Copy them from there rather than deriving them**,
so that retuning the bands fails a test instead of silently moving every config
anyone saved.

### Two traps in that table

**The same normalized value means different things per shape.** `body.n` is read
over `3.4–6` for `boxy` and `1.9–2.5` for everything else, and `body.rot` is only
read at all when the shape is `boxy`. So a "squareness" slider at 0.5 is a
different squareness on a boxy body than on a round one, and a tilt slider does
nothing on five of the six shapes. Decide deliberately: hide controls that do not
apply to the current shape, or show them disabled with a reason. Silently inert
controls are the worst of the three.

**Decoration controls are shape-conditional too.** `sun.*` only applies to suns,
`cloud.*` to clouds, `nub.*` to nubs — three disjoint groups, at most one live at
a time. Same decision as above, and it should be the same answer.

### Locks and shuffle

The control pattern that makes this feel like a tool rather than a form: each
axis has a lock, and a shuffle button re-rolls everything unlocked.

It carries most of the product on its own. Someone who does not want to think
about sliders can shuffle until they like something and leave; someone who does
can lock the two axes they care about and explore the rest. And it maps exactly
onto the output — **locked axes are the ones that appear in the snippet**, so the
UI state and the generated code are the same data structure, which is the
property that keeps them from drifting.

Whether unlocked axes shuffle by changing the `name` (everything unlocked moves
together, coherently) or by rolling each unlocked trait independently is a real
design choice with different feels. The first is more likely to produce blobatars
that look designed. Try both.

## The snippet

The whole point. It should look like something a person would have written:

```tsx
import { Blobatar } from "sketchy-blobatar/react";

<Blobatar
  name={user.email}
  traits={{
    shape: 0.95,
    "eye.ratio": 0.1,
  }}
/>;
```

Rules:

- **Only pinned keys.** Never emit the full map when a handful are locked.
- **Quote keys that need it, leave bare the ones that do not.** `shape` is a
  valid identifier; `"eye.gap"` is not. Emitting every key quoted is uniform and
  slightly uglier; either is defensible, but pick one and be consistent.
- **Round the values.** Six decimals from a slider is noise. Three is plenty and
  reads as a number someone chose.
- **No `traits` prop at all when nothing is pinned** — that is the Hero's
  only-what-differs rule, and it is what keeps the default story ("one prop")
  intact on a page whose whole subject is configuration.
- **Offer the string-API form too.** `blobatar(seed, { traits })` — and remember
  that one takes `seed` where the component takes `name`. A segmented control
  between the two is cheap and the Hero has the precedent for the pattern.
- **`animate="hover"` needs `import "sketchy-blobatar/motion.css"`.** The Hero's snippet
  includes it. If the editor's preview animates, the snippet must say so, and it
  should mention that animating changes the rendering mode from one `<img>` to
  inline SVG.

The acceptance test for all of this is mechanical: paste the snippet into a
scratch file, render it, and it must produce the blobatar that was on screen.

## Decided, and not yours to revisit

These are settled. Reopening them costs the library its guarantees or its budget:

- **Trait overrides are the only configuration seam.** No new library options, no
  passing a custom layout function, no patching resolved geometry.
- **Units are normalized 0–1.** Not degrees, not pixels.
- **`shape` is derived, not set.** You override the `shape` *trait*; the same
  thresholds turn it into a silhouette. There is no `shape` option and there will
  not be one.
- **No shareable URL string.** Considered and set aside — see the ADR. If you
  want editor state in the URL, `base64(JSON)` or `URLSearchParams` is an
  app-level concern that touches nothing in the package. Do not build an encoder
  into the library.
- **Macro mappings live in the app.** They will be retuned; library ranges cannot
  be.
- **`hue` and `tone` options beat `traits.hue` and `traits.tone`.** Two ways to
  say one thing. Pick one per axis and use it consistently — mixing them in one
  snippet is confusing, and the Hero already uses `hue` in degrees.

## Yours to decide

Page placement and route. Layout and composition. Which controls survive the
prune. Macro curves. Lock/shuffle interaction and how re-rolling works. Slider
primitive and its styling. Whether state goes in the URL. Mobile behaviour.
Whether the preview animates by default — `animate="hover"` on a single large
blobatar is defensible, `"always"` more so on a hero-sized one, and both cost the
inline-SVG rendering mode.

## Acceptance

- Copy the snippet, paste it, and the rendered blobatar matches the preview
  exactly. This is the one that matters.
- No control is silently inert. Anything that does not apply to the current shape
  is hidden or visibly disabled.
- A clamped axis reads as clamped rather than as broken — the resolved value is
  visible when `fit` has pulled it back.
- Nothing pinned means no `traits` prop in the output.
- `bun run check` stays green from the repo root. The site's `check` is currently
  `true`, so this is a low bar; consider whether the snippet generator deserves a
  real test, since it is the one piece with a correctness property worth pinning.
- No diff under `packages/sketchy-blobatar/`.

## Reference

| File                                                | Why                                      |
| --------------------------------------------------- | ---------------------------------------- |
| `docs/adr/0003-configuration-as-trait-overrides.md` | Why the API is this shape                |
| `packages/sketchy-blobatar/src/styles/blob.ts`      | Every trait key, its range, its meaning  |
| `packages/sketchy-blobatar/src/traits.ts`           | The override seam and its clamp          |
| `packages/sketchy-blobatar/README.md` § Configuring | The consumer-facing account              |
| `packages/sketchy-blobatar/test/traits.test.ts`     | Shape band midpoints; `blobLayout` helper |
| `packages/sketchy-blobatar/test/keys.ts`            | The full blob trait keyspace, as a list  |
| `apps/site/src/components/Hero.tsx`                 | The existing panel and `snippet()`       |
| `CONTEXT.md`                                        | Vocabulary — Name vs Seed, Override      |

Follow the house style in the code you write: comments carry the *why*, not the
what, and the surrounding files set the bar.
