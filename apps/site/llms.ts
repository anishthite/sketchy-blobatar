/**
 * `/llms.txt` — the API, in prose, at a fixed URL.
 *
 * The landing page is a client-rendered SPA: fetch it and you get an empty
 * `<div id="root">` and a script tag. Every claim the site makes about this
 * library is assembled in the browser, so for anything that reads HTML without
 * executing it — an LLM fetching a URL, a link unfurler, a crawler on a budget
 * — this file is the only description of blobatar at the domain.
 *
 * Derived from the package README rather than written beside it, because a
 * second hand-maintained description of the same API is a second thing to get
 * wrong. There is no editorial layer here: what ships is what the README says,
 * minus the parts a consumer cannot act on.
 */
import { dirname, join } from "node:path";

const REPO = "https://github.com/anishthite/sketchy-blobatar";

/** Resolved through the package's own exports rather than by relative path,
 * for the reason the README gives for the apps doing the same: a path that goes
 * through `exports` breaks loudly if the package is restructured, and
 * `./package.json` is an export precisely so tooling can find the root. */
const README = join(
  dirname(Bun.resolveSync("sketchy-blobatar/package.json", import.meta.dir)),
  "README.md",
);

export const LLMS_PATH = new URL("./public/llms.txt", import.meta.url).pathname;

export async function writeLlmsTxt() {
  const readme = await Bun.file(README).text();

  // Everything before "## Development" — build commands, the workspace layout
  // and the tuning grid describe contributing to blobatar, not using it, and
  // an agent reading this is doing the latter.
  const [usage] = readme.split("\n## Development");

  const text = usage!
    // llms.txt asks for H1, then a blockquote summary. The README opens with
    // exactly that shape already, one line short of the punctuation — so this
    // promotes its tagline rather than authoring a competing one, and slips the
    // two facts a reader of the file rather than the repo would otherwise lack:
    // how to install it, and where the source is.
    .replace(
      /^(# sketchy-blobatar\n\n)(.+)\n/,
      (_, heading, tagline) =>
        `${heading}> ${tagline}\n\nInstall: \`bun add sketchy-blobatar\` (or npm/pnpm/yarn). ` +
        `Source and issues: ${REPO}. MIT.\n`,
    )
    // Relative links resolve against the repo, not against this URL. Left
    // alone they would point at `/docs/...` on the site, which does not exist.
    .replace(
      /\]\(\.\/(docs\/[^)]+)\)/g,
      `](${REPO}/blob/main/packages/sketchy-blobatar/$1)`,
    );

  await Bun.write(LLMS_PATH, text);
}
