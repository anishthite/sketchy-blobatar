# sketchy-blobatar

Deterministic outlined blobatars from any string. No dependencies, ~5 KB gzipped.

```ts
import { blobatar } from "sketchy-blobatar";

blobatar("alain@example.com"); // => '<svg xmlns="..." viewBox="0 0 100 100">…'
```

```tsx
import { Blobatar } from "sketchy-blobatar/react";

<Blobatar name={user.email} size={48} />;
```

A blobatar always stands for somebody — a user, a bot, a team, a repo — so the
value it is generated from is that somebody's `name`: a username, a display
name, an email, a handle, an id. Any string works and the same string always
renders the same blobatar.

```ts
import { blobatarUri } from "sketchy-blobatar/uri";

el.style.backgroundImage = `url("${blobatarUri(user.id)}")`;
```

## Shapes

An irregular outline, two small eyes and a quiet smile, drawn from a vocabulary
of six silhouettes:
`round`, `organic`, `boxy`, `nub`, `cloud`, `sun`. Weighted so rounds and pebbles
are everyday and suns are a find. Transparent backdrop by default; the outline
is the blobatar.

The main entry also carries the palette and trait utilities. If all you do is
render, import the renderer on its own and save about a kilobyte:

```ts
import { blobatar } from "sketchy-blobatar/blob";
```

## Styles

Outlined is the default. To retain the original filled treatment while keeping
the same name-derived silhouette and palette, set `variant` to `"original"`:

```tsx
<Blobatar name={user.email} variant="original" size={48} />;
```

## Accessories

Accessories are optional, deterministic line art in the same palette and
rounded-outline vocabulary as the blobatar. Existing blobatars stay unchanged
until you ask for them. `"seeded"` chooses one signature piece from the name;
use the three slots to choose an exact look instead:

```tsx
<Blobatar
  name={user.email}
  accessories={{
    headwear: "beanie", // or "cap" or "auto"
    eyewear: "round", // or "sunglasses" or "auto"
    wearables: "scarf", // or "bowtie" or "auto"
  }}
/>
```

Set a slot to `false` when composing a configuration and you want to suppress
it. `auto` reads a category-specific trait from the name, so it is stable for
that name and does not reshuffle the body or face.

## What it guarantees

**Determinism.** The same name always renders the same blobatar within a major
version. Numeric ranges, the shape thresholds, the tone set and the expression
roster are all part of that contract.

**Stability across versions.** Traits are addressed by string key rather than
drawn from a sequential stream, so adding a trait in a later minor cannot
disturb existing blobatars. Adding a shape or a tone _would_, so those are frozen
per major.

**Contrast.** Eyes clear 4.5:1 against the body at every hue and every tone —
verified at 1° resolution in the test suite. Polarity flips automatically, so
the near-black tone gets light eyes rather than an invisible face.
Colors passed via the `palette` option bypass all of this, by definition.

**Name normalization.** Names are NFC-normalized, trimmed and lowercased before
hashing, so `Alain@Example.com` and `alain@example.com` agree, as do the
precomposed and decomposed spellings of `café`. Pass `normalize: false` to hash
the raw string. Hashing runs over UTF-8 bytes, so non-ASCII and astral-plane
names (`日本語`, `🦊`) behave consistently across engines.

**No element ids.** Nothing uses `<defs>`, gradients or filters, so rendering
several hundred blobatars on one page cannot produce id collisions.

## Options

| Option       | Default     | Notes                                                                   |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `size`       | —           | Emits `width`/`height`. Omit to let CSS size it.                        |
| `background` | none        | `"squircle"`, `"circle"`, `"square"`, or `false`.                       |
| `hue`        | —           | Locks hue in degrees; the name then drives shape only.                 |
| `tone`       | —           | Locks the swatch as a 0–1 position in the set.                          |
| `variant`    | `"outlined"` | `"original"` restores the filled treatment.                          |
| `accessories` | —          | `"seeded"` or exact headwear, eyewear, and wearable choices.            |
| `traits`     | —           | Pins individual traits as 0–1 positions. See below.                    |
| `palette`    | —           | Per-key hex overrides. Bypasses the contrast guarantee.                 |
| `normalize`  | `true`      | NFC + trim + lowercase.                                                 |
| `contrast`   | `true`      | Enforce the contrast floors.                                            |
| `title`      | —           | Adds a `<title>` for screen readers.                                    |
| `animate`    | —           | `"hover"` or `"always"`. See below — it changes how the blobatar renders. |
| `expression` | `"idle"`    | An imported pose value. See below.                                        |

## Configuring

Every axis of a blobatar is a named trait, and `traits` pins any of them. Values
are the 0–1 position the hash would otherwise have produced, so they are read in
the same units, through the same ranges, as a hashed one:

```ts
// Always a sun with wide eyes — colour and everything else still per name.
blobatar(user.email, { traits: { shape: 0.95, "eye.ratio": 0 } });
```

Keys you leave out still come from the name. That is the useful middle ground:
lock the two things that carry your brand, and every user still gets their own
creature.

Pin everything and the name stops mattering, which is how you build one fixed
blobatar — pass any constant string alongside a full map.

Nothing is bypassed. The layout runs in full, so an eye cluster too large for
its body is scaled to fit exactly as a hashed one would be, and no combination
of values can put an eye outside the body or geometry outside the frame — the
test suite sweeps the corners of the space to prove it. The flip side is that an
extreme value can land short of where you asked; `_layout()` reports what it
actually resolved to.

`hue` and `tone` state two of these traits in friendlier units — degrees and a
swatch position — and take precedence over `traits.hue` and `traits.tone`.

Trait keys are stable across minors, like the traits themselves. The ranges they
are read into are what a stated position is relative to, so those are frozen per
major alongside the shape thresholds and the tone set.

Trait names are not enumerated here on purpose: they follow the layout. Read them
off `styles/blob.ts`, or let the editor write the map for you.

## Animation

Off by default. When on, the blobatar idles: a soft breathe, a bob, a blink, and
the occasional glance to one side. Every timing and direction is drawn from the
name, so a grid reads as a crowd rather than a drill team.

```tsx
import { Blobatar } from "sketchy-blobatar/react";
import "sketchy-blobatar/motion.css"; // required — nothing animates without it

<Blobatar name={user.email} animate="hover" size={48} />;
```

**Turning this on changes the rendering mode, and that is not free.** A static
blobatar is a single `<img>`; an animated one is inline SVG, roughly a dozen DOM
nodes. Content inside an `<img>` is an isolated document that `:hover` cannot
reach and host-page CSS cannot style, so there is no way to have both. A list of
400 blobatars is exactly the case the `<img>` default was chosen for.

`"hover"` animates one blobatar at a time — the right default for a grid, where
continuous ambient motion is both visual noise and 400 live animations.
`"always"` is for the single-blobatar case: a profile header, an onboarding
screen.

Motion respects `prefers-reduced-motion` by going fully static, and does not
trigger on touch, where a tap would otherwise latch hover on.

The glance is a large-size effect — at 40px it moves the eyes about half a
pixel. It is worth the most on a profile header, which is what `"always"` is
for. Eyes may cross outside the body outline on a hard glance; that is intended,
and reads as a face turning rather than as a bug.

Currently `sketchy-blobatar/react` only. The string API still returns static markup:
supporting `animate` there means every consumer of `blobatar()` carries the motion
code whether they animate or not, which is a real cost for a feature most
callers will never use. If you need animated markup without React, open an issue
— it wants its own entry point rather than a branch inside `blobatar()`.

## Expressions

A pose the blobatar holds until you change it — `idle` (the default), `happy`,
`sad`, `mad`, `sleepy`, `excited`, `suspicious`, or `bashful`. Setting one
morphs from whatever it was wearing.

Expressions are **imported as values, not named as strings**, so you ship the
ones you use and nothing else:

```tsx
import { happy, idle } from "sketchy-blobatar/expression";

<Blobatar name={user.email} animate="always" expression={happy} size={64} />;
```

The first expression you import costs about 340 bytes (the shared serializer,
paid once) and each one after it about 36. A consumer who imports none carries
no pose code at all — which is why `expression` is a value rather than a string.

**A state, not an event.** Nothing returns to `idle` on its own and there are no
timers. If you want a burst, schedule the clear yourself:

```ts
setMood(happy);
setTimeout(() => setMood(idle), 1200);
```

**Independent of `animate`, in both directions.** Without `animate` you get the
pose statically, which is why this works in the string API and under
`prefers-reduced-motion`. The _morph_ needs `animate`, because that is what puts
the blobatar in inline SVG where CSS can reach it. Setting `expression` never
turns `animate` on for you — that would silently flip a 400-blobatar grid from 400
`<img>` tags to 400 SVG trees.

```ts
blobatar(name, { expression: happy }); // static, posed, no morph
```

`idle` renders byte-identical markup to omitting the option, so adding this
moved no existing blobatar.

The pose moves parts the blobatar already has — eyes and body — and never adds
or removes a mark. The smile stays as a visual anchor while the mood presets
make the eye pair read clearly differently from idle and from each other.
See [docs/expression-spec.md](./docs/expression-spec.md) for what carries signal
and what does not.

Expressions are decorative and do not reach assistive technology: `title` names
who the blobatar is and does not change with the pose. Under reduced motion the
pose is adopted instantly at full strength — the morph is removed, the
expression is not.

## How it works

**One primitive carries the symmetric shapes** — the superellipse
`|x/a|^n + |y/b|^n = 1`. `n=2` is an ellipse, `n≈4` a squircle, `n≈5` a rounded
bar. Each quadrant is one cubic Bézier whose control offset is solved so the
curve passes exactly through the 45° point; at `n=2` that yields 0.5523, the
standard circle constant. Four segments keeps a part at ~130 bytes of path data.

**A closed Catmull-Rom spline carries the organic ones.** Radii sampled around a
circle and joined into a loop, so a hash perturbing them by ±16% produces
lopsided pebbles with no noise function. Catmull-Rom interpolates its points
exactly, which is what makes the radii mean what they say and keeps containment
predictable.

**Layered contours avoid boolean geometry.** Clouds, suns and nubs are extra
circles drawn behind the core outline. Their repeated loops are intentional,
giving the silhouettes a hand-drawn scallop without path arithmetic, clip paths
or element ids.

**Eye dimensions are fractions of the body radius**, not absolute units. Bodies
range from 22 to 38 units depending on how much room the decoration needs, and
absolute sizes would drift off a small sun while looking lost on a large round.

Colors are resolved from OKLCh to hex at render time rather than emitted as
`oklch()`, because server-side rasterizers largely do not support it and blobatars
get rasterized server-side constantly.

Whole blobatars land at about 1.1–1.6 KB of markup.

## Development

Run these from the repo root — this package lives in a Bun workspace alongside
`apps/site` (the landing page) and `apps/demo` (the tuning grid).

```sh
bun dev        # tuning grid at localhost:3001
bun site       # landing page at localhost:3000
bun test       # 94 tests
bun run size   # per-entry gzip budgets
bun run check
```

Both apps depend on `sketchy-blobatar` as `workspace:*` and import it by its public
entry points, so they resolve through the real `exports` map rather than by
relative path — breaking an export breaks their build. See
[ADR-0001](../../docs/adr/0001-bun-workspaces-without-turborepo.md).

The tuning grid is the real design tool. Numeric ranges can only be judged in
aggregate — you are looking for clusters, dead zones and outliers, which are
invisible when you inspect one name at a time. The shape filter exists because
the rarer silhouettes would otherwise show up a handful of times per page, too
few to tune against.

`test/geometry.test.ts` covers what eyeballing cannot: that no name anywhere in
the space puts an eye off the body, collides the two eye envelopes, detaches a
petal, or pushes geometry outside the frame.
