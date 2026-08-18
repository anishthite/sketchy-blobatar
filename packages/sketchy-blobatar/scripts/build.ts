/**
 * Publish build.
 *
 * `exports` in package.json points at `dist`, because what goes to npm has to
 * be JS a plain Node resolver and a non-transpiling bundler can both read. This
 * script produces it. (The workspace apps do not wait on it — they alias
 * `sketchy-blobatar/*` to `src` through tsconfig paths.)
 *
 * Each entry is bundled standalone. Code splitting is the obvious way to stop
 * `blob` and the barrel carrying private copies of the same renderer, and it
 * is unusable here: on Bun 1.3.14 a pure re-export barrel like `src/index.ts`
 * compiles to `import "./chunk.js"; export { palette, ... }` — names re-exported
 * out of a module that never imported them, which is a SyntaxError the moment
 * Node links it. `scripts/smoke.mjs` is what caught that, and is why it runs on
 * every build.
 *
 * The cost of standalone entries is paid only by a consumer importing two of
 * them, who gets the shared core twice. That is the rarer case, and a wrong
 * package is not a tradeoff.
 */

import { rmSync } from "node:fs";
import { $ } from "bun";

const ENTRIES = [
  "src/index.ts",
  "src/blob.ts",
  "src/uri.ts",
  "src/expression.ts",
  "src/react.tsx",
];

rmSync("dist", { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ENTRIES,
  outdir: "dist",
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  // React is a peer dependency and an optional one: never inline it, and never
  // let the JSX runtime import get rewritten into the bundle either.
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"],
  // What selects the JSX runtime. Bun reads `process.env.NODE_ENV` to choose
  // between `jsx` and `jsxDEV`, and a publish build run from a normal shell has
  // it unset — so without this the package shipped `react/jsx-dev-runtime`
  // calls. That resolves fine under Node, which is why `smoke.mjs` stayed green
  // on it, and dies in any consumer bundling for production, where that
  // specifier carries no `jsxDEV`: every animated blobatar throws
  // `jsxDEV is not a function` on first render.
  //
  // Stated here rather than as an env var on the script so that `bun run build`
  // yields the same package whatever the shell or CI has set. The failure is
  // invisible locally and only reaches a consumer, so it cannot be left to
  // ambient state.
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

// The stylesheet ships minified. `src/motion.css` is ~44 KB, nearly all of it
// the commentary explaining why each channel exists — worth reading in the
// repo, not worth shipping to a consumer who drops it in a <link> and gets no
// bundler pass over it.
const css = await Bun.build({
  entrypoints: ["src/motion.css"],
  outdir: "dist",
  minify: true,
});

if (!css.success) {
  for (const log of css.logs) console.error(log);
  process.exit(1);
}

// Types come from tsc, not from the bundler — Bun does not emit declarations.
await $`bunx tsc -p tsconfig.build.json`;

// Every map embeds a full copy of every source it covers, and the package ships
// `src` anyway for the declaration maps to point at. Five entries duplicating
// the same tree is 330 KB of a 380 KB tarball. The maps' `sources` are already
// relative paths into the shipped `src`, so dropping the inline copies costs
// nothing and a debugger still resolves them.
for (const out of build.outputs) {
  if (out.kind !== "sourcemap") continue;
  const map = await Bun.file(out.path).json();
  delete map.sourcesContent;
  await Bun.write(out.path, JSON.stringify(map));
}

for (const out of build.outputs) {
  if (out.kind !== "entry-point") continue;
  console.log(`✓ ${out.path.replace(process.cwd() + "/", "")}`);
}
