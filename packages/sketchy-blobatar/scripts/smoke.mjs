/**
 * What a consumer gets, checked the way a consumer gets it.
 *
 * Runs under **Node**, deliberately: Bun transpiles TypeScript, resolves
 * extensionless specifiers and is forgiving about module linking, so a package
 * can be thoroughly broken for the rest of the ecosystem while `bun test` stays
 * green. This file linked `dist/index.js` under Node and found exactly that —
 * a bundler bug re-exporting names out of a module that never imported them.
 *
 * Plain `.mjs` rather than `.ts` for the same reason: nothing may transpile it.
 * Every import goes through the package name, not a relative path, so the
 * `exports` map is under test too and a missing subpath fails here.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { blobatar, palette, traits, normalizeSeed } from "sketchy-blobatar";
import { blobatar as blob } from "sketchy-blobatar/blob";
import { blobatarUri } from "sketchy-blobatar/uri";
import {
  bashful,
  excited,
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  suspicious,
  unsure,
  wink,
} from "sketchy-blobatar/expression";
import { Blobatar } from "sketchy-blobatar/react";

let failed = false;

const check = (name, fn) => {
  try {
    const detail = fn();
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    console.error(`✗ ${name} — ${err.message}`);
    failed = true;
  }
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const svg = (s, what) => {
  assert(typeof s === "string", `${what} did not return a string`);
  assert(s.startsWith("<svg"), `${what} did not return SVG: ${s.slice(0, 40)}`);
  assert(s.includes("</svg>"), `${what} returned truncated SVG`);
  return s;
};

check("blobatar()", () => `${svg(blobatar("alain@example.com"), "blobatar").length} chars`);
check("blobatar/blob", () => `${svg(blob("alain"), "blob").length} chars`);

check("blobatar/expression", () => {
  const expressions = {
    happy,
    mad,
    sad,
    sleepy,
    excited,
    suspicious,
    bashful,
    idle,
    surprised,
    wink,
    smug,
    unsure,
    scared,
    love,
    shy,
    sick,
  };
  for (const [name, pose] of Object.entries(expressions)) {
    assert(pose != null, `${name} is not exported`);
    svg(blob("alain", { expression: pose }), `blob + ${name}`);
  }
  return Object.keys(expressions).join(", ");
});

check("blobatar/uri", () => {
  const uri = blobatarUri("alain");
  assert(uri.startsWith("data:image/svg+xml,"), `bad data URI prefix: ${uri.slice(0, 30)}`);
  assert(!uri.includes("#"), "unescaped # would truncate the URI in CSS");
  return `${uri.length} chars`;
});

check("blobatar/react", () => {
  const html = renderToStaticMarkup(createElement(Blobatar, { name: "alain", size: 48 }));
  assert(html.includes("<img"), `static mode did not render an <img>: ${html.slice(0, 60)}`);
  assert(html.includes("data:image/svg+xml"), "static mode rendered no blobatar");
  return "renders on the server";
});

check("blobatar/react animated", () => {
  const html = renderToStaticMarkup(
    createElement(Blobatar, { name: "alain", size: 48, animate: true }),
  );
  assert(html.includes("<svg"), "animated mode did not render inline SVG");
  assert(html.includes("mo-root"), "animated mode emitted no motion class");
  return "inline SVG with motion classes";
});

/**
 * The one check here that reads the build rather than running it.
 *
 * A dev-runtime build passes every other assertion in this file: Node resolves
 * `react/jsx-dev-runtime` and `jsxDEV` works, so the component renders and the
 * smoke test goes green on a package that throws
 * `jsxDEV is not a function` for anyone bundling for production. Nothing
 * observable at runtime *here* distinguishes the two builds, so the specifier
 * itself is the assertion. See the `define` in `scripts/build.ts`.
 */
check("blobatar/react ships the production JSX runtime", () => {
  const path = createRequire(import.meta.url).resolve("sketchy-blobatar/react");
  const src = readFileSync(path, "utf8");
  assert(
    !src.includes("jsx-dev-runtime") && !src.includes("jsxDEV"),
    "built with the development JSX transform — it will throw in production bundlers",
  );
  return "jsx-runtime";
});

check("named exports on the barrel", () => {
  assert(typeof palette === "function", "palette is not a function");
  assert(typeof traits === "function", "traits is not a function");
  assert(typeof normalizeSeed === "function", "normalizeSeed is not a function");
  assert(palette(200).bg?.startsWith("#"), "palette did not resolve to hex");
  return "palette, traits, normalizeSeed";
});

check("determinism", () => {
  assert(blobatar("alain") === blobatar("alain"), "same name rendered differently twice");
  assert(blobatar("alain") !== blobatar("alaim"), "one character changed nothing");
  return "same in, same out";
});

check("blobatar/motion.css", () => {
  const path = createRequire(import.meta.url).resolve("sketchy-blobatar/motion.css");
  assert(existsSync(path), `resolved to a file that does not exist: ${path}`);
  return path.split("/").slice(-2).join("/");
});

process.exit(failed ? 1 : 0);
