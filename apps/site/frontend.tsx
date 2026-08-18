import { createRoot, hydrateRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./src/App";
// Required — nothing animates without it, and the hero is `animate="always"`.
//
// Imported *before* the page's own stylesheet, and the order is load-bearing:
// `styles.css` cancels the library's hover reaction, and both rules are
// unlayered and equally specific, so the later file is the one that wins.
import "sketchy-blobatar/motion.css";
import "./styles.css";

// `<Analytics />` renders nothing — it injects Vercel's `/_vercel/insights`
// script, which only exists once the site is deployed. Locally it falls back to
// the debug script and logs to the console instead of sending anything.
const root = document.getElementById("root")!;

const tree = (
  <>
    <App />
    <Analytics />
  </>
);

/*
 * Which of the two depends on who served the page, and the check is for markup
 * rather than for a build flag because that is the thing that actually differs.
 *
 * `build.ts` prerenders `<App />` into `#root`, so in production the markup is
 * already there and hydrating adopts it. The dev server has no prerender step —
 * it hands over `index.html` as authored, with an empty root — and hydrating
 * that logs "server rendered HTML didn't match" on every reload. React recovers
 * by rendering client-side anyway, which is the right result reached by way of
 * an error message, and an error you are trained to ignore is worse than no
 * error at all.
 */
if (root.firstChild) hydrateRoot(root, tree);
else createRoot(root).render(tree);
