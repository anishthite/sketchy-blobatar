/**
 * The generator.
 *
 * The snippet is the page's deliverable — the tuned blobatar on screen is the
 * demonstration, this is the thing you leave with — so this is the one piece
 * here with a correctness property worth pinning, and `snippet.test.ts` pins
 * it: paste the output, render it, get the blobatar that was on screen.
 *
 * Pure, and separate from the panel for exactly that reason. A generator living
 * inside the component would be testable only by rendering one.
 */
import { KEY_ORDER } from "./axes";

export type Api = "react" | "string";
export type Motion = false | "hover" | "always";

export interface SnippetInput {
  api: Api;
  /** The name the preview is showing. Emitted literally — see `nameNote`. */
  name: string;
  /** The pinned traits. Empty means no `traits` at all in the output. */
  pinned: Record<string, number>;
  motion: Motion;
}

/**
 * `shape` is a valid identifier and `"eye.gap"` is not.
 *
 * Quoting every key would be uniform and slightly uglier; both are defensible
 * and the rule is to pick one. This picks the one a person writing the object
 * by hand would produce, since looking hand-written is the whole brief.
 */
const bare = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const key = (k: string) => (bare.test(k) ? k : JSON.stringify(k));

/**
 * Panel order, then anything else.
 *
 * The fallback is not dead code: it is what keeps an unknown key — one added to
 * `AXES` and forgotten here, or one restored from a config someone hand-edited
 * — in the output instead of silently dropped.
 */
function entries(pinned: Record<string, number>) {
  const known = KEY_ORDER.filter(k => k in pinned);
  const rest = Object.keys(pinned).filter(k => !KEY_ORDER.includes(k));
  return [...known, ...rest].map(k => [k, pinned[k]!] as const);
}

/**
 * JSX attribute strings are not JS strings — no backslash escapes — so a name
 * containing a quote cannot be written as `name="…"` at all. Fall through to an
 * expression container, where the JS literal `JSON.stringify` produces is
 * exactly right. Same helper as the hero's, same reason.
 */
const attr = (value: string) =>
  /["\\]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;

/**
 * The name is emitted literally, and it has to be.
 *
 * A real call site says `name={user.email}`, and the temptation is to emit that
 * — but every axis left unpinned still comes from the name, so a snippet that
 * substitutes a variable for the string the preview used renders a different
 * blobatar. The literal is the honest output; the comment is what tells you
 * which half of it is yours to replace.
 */
const nameNote = "// everything below comes from the name unless it is pinned";

export function snippet({ api, name, pinned, motion }: SnippetInput): string {
  const traits = entries(pinned);
  const seed = name || "sketchy";

  return api === "react"
    ? react(seed, traits, motion)
    : string(seed, traits, motion);
}

function react(
  seed: string,
  traits: (readonly [string, number])[],
  motion: Motion,
) {
  const lines = [`import { Blobatar } from "sketchy-blobatar/react";`];
  // The trade the library documents, stated where it is taken rather than in
  // prose beside the box: animating is what moves the blobatar out of a single
  // `<img>` and into a dozen inline SVG nodes.
  if (motion)
    lines.push(
      `import "sketchy-blobatar/motion.css"; // animate renders inline SVG, not one <img>`,
    );

  lines.push("");
  if (traits.length) lines.push(nameNote);

  lines.push(`<Blobatar`, `  name=${attr(seed)}`);

  // One key inline, several over lines. A person writing `{ shape: 0.14 }`
  // does not break it across four lines, and a person writing six of them does
  // not leave it on one.
  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`  traits={{ ${key(k)}: ${v} }}`);
  } else if (traits.length) {
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  }}`);
  }

  if (motion) lines.push(`  animate="${motion}"`);
  lines.push(`/>;`);

  return lines.join("\n");
}

function string(
  seed: string,
  traits: (readonly [string, number])[],
  motion: Motion,
) {
  const lines = [`import { blobatar } from "sketchy-blobatar";`, ""];

  // `animate` is honored by `sketchy-blobatar/react` only — the string API returns
  // static markup whatever it is passed. Dropping it silently on the way over
  // would make this snippet a quieter blobatar than the one on screen, so it is
  // dropped out loud.
  if (motion)
    lines.push(`// animate is a sketchy-blobatar/react option — this renders static markup`);
  if (traits.length) lines.push(nameNote);

  // Named `seed` here where the component takes `name`: same value, and the
  // words differ because they are read in different positions. See CONTEXT.md.
  const call = `const svg = blobatar(${JSON.stringify(seed)}`;

  if (!traits.length) return [...lines, `${call});`].join("\n");

  lines.push(`${call}, {`, `  traits: {`);
  for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
  lines.push(`  },`, `});`);

  return lines.join("\n");
}
