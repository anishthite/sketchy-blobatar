import { serve } from "bun";
import { readdir } from "node:fs/promises";
import { writeFavicon } from "./favicon";
import { writeLlmsTxt } from "./llms";

// Both before anything reads for them: importing `index.html` is what resolves
// the `<link rel="icon">` href, and the asset routes below enumerate `public/`.
// On a clean checkout neither generated file exists yet.
await writeFavicon();
await writeLlmsTxt();

const { default: index } = await import("./index.html");
const { default: editor } = await import("./editor.html");

/**
 * `public/` at the root, mirroring what the build copies into `dist`.
 *
 * Enumerated at boot rather than matched with a wildcard: `/:file` would sit in
 * front of the SPA fallback and have to decide, per request, whether a miss is
 * a missing asset or a route the page should render. One entry per real file
 * has no such ambiguity — anything not in the directory never matches.
 */
const assets = Object.fromEntries(
  (await readdir("public")).map(name => [
    `/${name}`,
    new Response(Bun.file(`./public/${name}`)),
  ]),
);

const server = serve({
  routes: {
    // Served straight off disk, matching the absolute `/fonts/...` URL in
    // `styles.css`. Keeping them out of the bundler is what stops Bun inlining
    // them into the stylesheet as base64.
    "/fonts/:file": req => {
      const file = Bun.file(`./fonts/${req.params.file}`);
      return new Response(file, {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      });
    },
    ...assets,
    /*
     * Its own document, ahead of the SPA fallback.
     *
     * Not a client-side route: the editor is a second entrypoint with its own
     * bundle, so that nothing it needs — the slider, the control set, the layout
     * readback — is downloaded by someone who only ever reads the landing page.
     * See the note on `entrypoints` in `build.ts`.
     *
     * Both spellings, because that is what the deployment serves: `cleanUrls`
     * in `vercel.json` maps `/editor` onto `dist/editor.html` and redirects the
     * extension away, and a dev server that only answered one of them would
     * disagree with production about a link somebody had already shared.
     */
    "/editor": editor,
    "/editor.html": editor,
    "/*": index,
	},
	port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`Sketchy Blobatar site → ${server.url}`);
