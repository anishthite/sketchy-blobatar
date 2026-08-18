import { Blobatar } from "sketchy-blobatar/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Facepile } from "@/components/ui/facepile";
import { useNearViewport } from "@/lib/near-viewport";

/**
 * The thread, flat and in order. Grouping consecutive messages from one person
 * is done at render time rather than stored as nested runs, because the
 * grouping is a presentation rule — a chat that inserts a message in the middle
 * regroups on its own, and data shaped as runs would have to be rebuilt.
 *
 * The four handles are chosen, not arbitrary: teal, orange, green and purple
 * out of the hash. A section whose claim is "you can tell these people apart"
 * cannot open with two seeds that both landed on pale blue — that is the one
 * draw of four this page is not entitled to.
 */
const THREAD = [
  { name: "laura", text: "shipped the new avatars — every account has one now", time: "9:41" },
  { name: "laura", text: "no uploads, no grey initials", time: "9:41" },
  { name: "tobias", text: "wait, they're generated from the username?", time: "9:42" },
  {
    name: "svea",
    text: "same string, same face, forever. mine has looked like this since I signed up",
    time: "9:43",
  },
  { name: "ivan", text: "so staging me and prod me are different people 😅", time: "9:43" },
  { name: "svea", text: "different string, different person. that's the whole trick", time: "9:44" },
];

type Message = (typeof THREAD)[number];

/** Consecutive messages from one person become one group with one avatar. */
function grouped(thread: Message[]) {
  return thread.reduce<Message[][]>((runs, msg) => {
    const last = runs.at(-1);
    if (last && last[0]!.name === msg.name) last.push(msg);
    else runs.push([msg]);
    return runs;
  }, []);
}

export function Chat() {
  const runs = grouped(THREAD);
  /*
   * The card is nine inline blobatars — the thread's five, the typing
   * indicator's one, and four more in the facepile — which makes it the second
   * heaviest thing on the page after the wall, and it sits two screens down.
   *
   * The heading and the paragraph above it are prerendered as normal, so the
   * argument this section makes is in the HTML either way; it is the
   * illustration that waits, and it waits for the scroll rather than for
   * hydration. See `useNearViewport` for why that distinction is the whole
   * point.
   */
  const [ref, near] = useNearViewport<HTMLElement>();

  return (
    // Heading and card share one column rather than a wide heading over a
    // narrower centred card — offset left edges read as two sections that
    // happen to be adjacent.
    <section ref={ref} className="defer-offscreen mx-auto max-w-2xl px-6 py-32">
      <div className="mb-10 max-w-lg">
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-medium tracking-[-0.04em]">
          Everyone gets a face
        </h2>
        <p className="text-muted mt-4 text-balance leading-relaxed">
          One prop per person, and the string does the rest. The same handle
          always produces the same blobatar, so whoever you learn in a thread is
          who you recognise in the sidebar.
        </p>
      </div>

      {/*
        Until hydration, the card's box without the card — same surface, border
        and radius, and a height close to what the thread fills. The swap then
        happens inside a shape that is already the right size, rather than
        growing the page under everything below it.
      */}
      {!near ? (
        <div
          className="bg-raised border-line h-[34rem] rounded-2xl border"
          aria-hidden="true"
        />
      ) : (
        /*
          Solid `bg-raised` rather than the card default: the facepile separates
          its avatars with a ring in the surface colour, and a translucent
          surface makes that ring a shade off whatever it happens to be over.
        */
        <Card className="bg-raised">
          <CardHeader>
            <span className="font-mono text-sm">
              <span className="text-muted">#</span> release
            </span>
            <Facepile names={["laura", "tobias", "svea", "ivan"]} extra={12} />
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {runs.map((run) => (
              <div key={`${run[0]!.name}-${run[0]!.time}-${run.length}`} className="flex gap-3">
                {/*
                  `animate="hover"` — a handful of inline SVGs is exactly the case
                  the library documents it for, and in a chat the reaction lands
                  on the one face you are pointing at rather than on a wall of
                  them. The page's own rule cancels the lift, so what you get is
                  the creature breathing and blinking, not the row twitching.
                */}
                <Blobatar
                  name={run[0]!.name}
                  animate="hover"
                  title={`Blobatar for ${run[0]!.name}`}
                  className="size-10 shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{run[0]!.name}</span>
                    <span className="text-muted font-mono text-[0.7rem]">
                      {run[0]!.time}
                    </span>
                  </div>
                  {/*
                    Every message in a run, under one name — which is the whole
                    reason to group them. Sender and time repeated on each line is
                    what makes a real chat log unreadable.
                  */}
                  <div className="mt-1 flex flex-col gap-1">
                    {run.map((msg) => (
                      <p key={msg.text} className="text-muted text-sm leading-relaxed">
                        {msg.text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/*
              A typing indicator, because the thread has to end somewhere and an
              unanswered question ends it better than one more message would. It
              is also the only place on the page where a blobatar stands for
              someone who has not said anything yet, which is the case an avatar
              is most useful in.
            */}
            <div className="flex items-center gap-3">
              <Blobatar
                name="tobias"
                animate="hover"
                title="Blobatar for tobias"
                className="size-10 shrink-0 opacity-50"
              />
              <div className="text-muted flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1" aria-hidden="true">
                  <i className="typing-dot" />
                  <i className="typing-dot" />
                  <i className="typing-dot" />
                </span>
                tobias is typing
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
