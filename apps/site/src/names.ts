/**
 * Seeds for the wall.
 *
 * Human handles rather than random strings. The library's own framing for
 * animation is that "a grid reads as a crowd rather than a drill team" — the
 * same is true of the seeds. A wall of `k7f2p9` proves the mathematical claim
 * and undercuts the emotional one; these are what blobatars are actually made
 * from.
 *
 * The wall shuffles these per visit and appends a numeric suffix, so the field
 * is different every load without needing a larger list.
 */
export const NAMES = [
  "sketchy", "astrid", "bao", "beatriz", "bjorn", "camille", "carlos", "chidi",
  "clara", "dagny", "daniela", "dario", "diego", "dmitri", "eero", "elena",
  "elias", "elin", "emeka", "emil", "esther", "fatima", "felix", "finn",
  "freya", "gabriel", "gita", "greta", "gustav", "hana", "hassan", "heidi",
  "henrik", "hugo", "ida", "ines", "ingrid", "isabel", "ivan", "jae",
  "jonas", "julia", "kai", "kaisa", "karim", "kasper", "katya", "keiko",
  "kenji", "kira", "klara", "kofi", "lars", "laura", "leena", "leif",
  "lena", "leo", "liam", "lila", "linnea", "lotta", "luca", "lucia",
  "ludvig", "magnus", "maja", "malin", "manon", "marco", "maren", "maria",
  "marta", "mateo", "mattias", "mei", "mikael", "milena", "mira", "nadia",
  "naoki", "nils", "nina", "noor", "nora", "olav", "olga", "oskar",
  "otto", "paavo", "pablo", "paloma", "petra", "pia", "priya", "rafael",
  "raisa", "rasmus", "rebecca", "ren", "rikke", "rosa", "ruben", "runa",
  "saga", "salma", "sanna", "sara", "sebastian", "selma", "sigrid", "silje",
  "simone", "sofia", "solveig", "sonja", "soren", "stella", "svea", "sven",
  "tamar", "tariq", "tenzin", "theo", "thora", "tobias", "tomas", "tove",
  "ulrik", "una", "valeria", "vera", "viktor", "vilma", "wei", "wilhelm",
  "yara", "yasmin", "yuki", "zaid", "zara", "zoya",
] as const;

/** Fisher-Yates over a copy — the source list stays stable across re-renders. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
