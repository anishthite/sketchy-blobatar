import { describe, expect, test } from "bun:test";
import { blobatar } from "sketchy-blobatar";
import { snippet, type Api } from "./snippet";
import { KEY_ORDER, round3 } from "./axes";

/**
 * The generator is the one piece of this page with a correctness property, so
 * it is the one piece with tests. Everything else here is layout and taste.
 *
 * The property, stated once: **the snippet reproduces the preview**. Pinning
 * rounds to three decimals and the generator emits what was pinned, so the two
 * are driven by the identical number — and `pasted` below is what checks that
 * end to end rather than by inspection, by parsing the emitted object literal
 * back out and rendering it.
 */

const NAME = "sketchy";

/** The `traits` literal from a generated snippet, evaluated. */
function pasted(code: string): Record<string, number> {
  const body = code.match(/traits[=:]\s*\{\{?([\s\S]*?)\}\}?[,\n]/);
  if (!body) return {};
  // `new Function` on our own generated string, in a test, is the point: it is
  // the closest thing to "paste this into a file" that a test can do, and it
  // fails on anything a bundler would also refuse.
  return new Function(`return ({${body[1]}})`)() as Record<string, number>;
}

describe("what it emits", () => {
  test("no traits prop at all when nothing is pinned", () => {
    for (const api of ["react", "string"] as Api[]) {
      const code = snippet({ api, name: NAME, pinned: {}, motion: false });
      expect(code).not.toContain("traits");
    }
  });

  test("only the pinned keys, never the whole map", () => {
    const code = snippet({
      api: "react",
      name: NAME,
      pinned: { shape: 0.965, "eye.gap": 0.8 },
      motion: false,
    });

    expect(pasted(code)).toEqual({ shape: 0.965, "eye.gap": 0.8 });
    expect(code).not.toContain("body.r");
  });

  test("keys are quoted only where they have to be", () => {
    const code = snippet({
      api: "react",
      name: NAME,
      pinned: { shape: 0.14, "eye.gap": 0.5 },
      motion: false,
    });

    expect(code).toContain("shape: 0.14");
    expect(code).toContain('"eye.gap": 0.5');
  });

  test("keys come out in panel order, whatever order they were pinned in", () => {
    const code = snippet({
      api: "react",
      name: NAME,
      pinned: { "eye.gap": 0.5, hue: 0.2, shape: 0.14 },
      motion: false,
    });

    expect(Object.keys(pasted(code))).toEqual(
      ["shape", "eye.gap", "hue"].sort((a, b) => KEY_ORDER.indexOf(a) - KEY_ORDER.indexOf(b)),
    );
  });

  test("a single key stays on one line, several do not", () => {
    const one = snippet({ api: "react", name: NAME, pinned: { shape: 0.14 }, motion: false });
    const two = snippet({
      api: "react",
      name: NAME,
      pinned: { shape: 0.14, hue: 0.2 },
      motion: false,
    });

    expect(one).toContain("traits={{ shape: 0.14 }}");
    expect(two).toContain("traits={{\n");
  });

  test("the React prop is `name` and the string API's argument is a seed", () => {
    // Same value, different word by position — get this backwards and the
    // snippet does not compile. See CONTEXT.md.
    const react = snippet({ api: "react", name: NAME, pinned: {}, motion: false });
    const string = snippet({ api: "string", name: NAME, pinned: {}, motion: false });

    expect(react).toContain(`name="${NAME}"`);
    expect(react).toContain(`from "sketchy-blobatar/react"`);
    expect(string).toContain(`blobatar("${NAME}")`);
    expect(string).toContain(`from "sketchy-blobatar"`);
  });

  test("a name that cannot be written as a JSX attribute becomes an expression", () => {
    // JSX attribute strings have no escapes, so `name="say "hi""` is not a
    // thing that can exist.
    const code = snippet({ api: "react", name: 'say "hi"', pinned: {}, motion: false });
    expect(code).toContain('name={"say \\"hi\\""}');
  });

  test("animating says so, in the import as well as the prop", () => {
    const code = snippet({ api: "react", name: NAME, pinned: {}, motion: "hover" });
    expect(code).toContain(`import "sketchy-blobatar/motion.css"`);
    expect(code).toContain(`animate="hover"`);
    expect(code).toContain("inline SVG");
  });

  test("the string API drops `animate` out loud rather than silently", () => {
    // `blobatar()` returns static markup whatever it is passed — animation is a
    // `sketchy-blobatar/react` option. Emitting it would be a snippet that lies.
    const code = snippet({ api: "string", name: NAME, pinned: {}, motion: "always" });
    expect(code).not.toContain("animate:");
    expect(code).toContain("// animate is a sketchy-blobatar/react option");
  });

  test("an empty name falls back rather than emitting nothing", () => {
    const code = snippet({ api: "react", name: "", pinned: {}, motion: false });
    expect(code).toContain(`name="sketchy"`);
  });
});

describe("paste it and you get the blobatar that was on screen", () => {
  /**
   * The acceptance test, mechanically: take the map the preview was rendering,
   * generate the snippet, parse the object literal back out of it, and render
   * *that*. The two markups have to be byte-identical.
   */
  const cases: Record<string, number>[] = [
    { shape: 0.965 },
    { shape: 0.14, "eye.gap": 0.999, "eye.rx": 0.999 },
    { "body.n": 0, "eye.lean": 0.5, hue: 0.123, tone: 0.71 },
    // Every key an axis can write, at a value that is not the default.
    Object.fromEntries(KEY_ORDER.map((k, i) => [k, round3((i * 37) % 1000 / 1000)])),
  ];

  for (const [i, pinned] of cases.entries()) {
    test(`case ${i}`, () => {
      for (const api of ["react", "string"] as Api[]) {
        const code = snippet({ api, name: NAME, pinned, motion: "hover" });
        expect(blobatar(NAME, { traits: pasted(code) })).toBe(
          blobatar(NAME, { traits: pinned }),
        );
      }
    });
  }
});
