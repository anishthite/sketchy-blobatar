import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { Editor } from "./src/Editor";
// Before the page's own stylesheet, exactly as `frontend.tsx` does it:
// `styles.css` cancels the library's hover reaction and both rules are
// unlayered and equally specific, so the later file wins.
import "sketchy-blobatar/motion.css";
import "./styles.css";

/*
 * `createRoot` rather than the hydrate-or-render branch the landing page uses,
 * because this document is never prerendered — `build.ts` skips the prerender
 * and the deferred-script rewrite here, and both halves of that are deliberate.
 *
 * Prerendering would put twenty controls and a dozen shape tiles into the HTML
 * for a page whose first frame is worthless until it can be dragged; the
 * landing page's own build notes measured that trade going the wrong way at far
 * less markup than this. And deferring the bundle to `load` buys first paint by
 * delaying interactivity, which is a trade a page you *read* can make and a page
 * that is nothing but controls cannot.
 */
createRoot(document.getElementById("root")!).render(
  <>
    <Editor />
    <Analytics />
  </>,
);
