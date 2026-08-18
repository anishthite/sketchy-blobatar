# sketchy-blobatar

Deterministic outlined blobatars from any string. No dependencies, ~4 KB
gzipped.

```sh
bun add sketchy-blobatar    # npm / pnpm / yarn all work too
```

## Usage

A blobatar always stands for somebody — a user, a bot, a team, a repo — so the
value it is generated from is that somebody's `name`: a username, a display
name, an email, a handle, an id. Any string works, and the same string always
renders the same blobatar.

### React

```tsx
import { Blobatar } from "sketchy-blobatar/react";

<Blobatar name={user.email} size={48} />;
```

Everything but `name` is optional. Remaining props land on the underlying
element, so `className`, `alt` and the rest behave as you would expect.

### Anywhere else

`blobatar()` returns SVG markup as a string, and `blobatarUri()` wraps it in a
`data:` URI for `<img src>` or `background-image`:

```ts
import { blobatar } from "sketchy-blobatar";
import { blobatarUri } from "sketchy-blobatar/uri";

blobatar("alain@example.com"); // '<svg xmlns="..." viewBox="0 0 100 100">…'

el.style.backgroundImage = `url("${blobatarUri(user.id)}")`;
```

The main entry also carries the palette and trait utilities. If all you do is
render, import the renderer on its own and save about a kilobyte:

```ts
import { blobatar } from "sketchy-blobatar/blob";
```

### Configuring

Options are the same for both APIs. `background`, `hue` and `tone` cover the
common cases; `traits` pins any individual axis as the 0–1 position the hash
would otherwise have produced:

```tsx
<Blobatar name={user.email} background="circle" hue={210} size={48} />;

// Restore the original filled treatment while preserving the same seed.
<Blobatar name={user.email} variant="original" size={48} />;

// Always a sun with wide eyes — colour and everything else still per name.
blobatar(user.email, { traits: { shape: 0.95, "eye.ratio": 0 } });
```

Keys you leave out still come from the name — lock the two things that carry
your brand, and every user still gets their own creature. Pin everything and the
name stops mattering, which is how you build one fixed blobatar.

### Animation and expressions

Both are opt-in. `animate` idles the blobatar — breathe, bob, blink, glance —
and expressions are imported as values so you ship only the poses you use:

```tsx
import { Blobatar } from "sketchy-blobatar/react";
import { happy } from "sketchy-blobatar/expression";
import "sketchy-blobatar/motion.css"; // required — nothing animates without it

<Blobatar name={user.email} animate="hover" expression={happy} size={64} />;
```

`animate` changes the rendering mode: a static blobatar is a single `<img>`, an
animated one is inline SVG. Use `"hover"` in a grid and `"always"` for the
single-blobatar case. Motion respects `prefers-reduced-motion`.

**[Full docs — options table, guarantees, and how it works →](./packages/sketchy-blobatar/README.md)**

## Workspace

| Path                | What it is                                               |
| ------------------- | -------------------------------------------------------- |
| `packages/sketchy-blobatar` | The library. [Docs here](./packages/sketchy-blobatar/README.md). |
| `apps/site`         | The landing page. Static, dark-only.                     |
| `apps/demo`         | The tuning grid — the internal design tool, not a demo.  |

```sh
bun install
bun dev        # tuning grid   → localhost:3001
bun site       # landing page  → localhost:3000
bun test       # library tests
bun run check  # tests + size budgets
```

[`CONTEXT.md`](./CONTEXT.md) is the glossary — worth two minutes before changing
anything, since `shape` and the `name`/`seed` split mean specific and
easily-confused things here. Architectural decisions live in [`docs/adr/`](./docs/adr/).
