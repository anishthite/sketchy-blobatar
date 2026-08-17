const FACTS = [
  ["~4 KB", "gzipped, blob only"],
  ["0", "dependencies"],
  ["6", "silhouettes"],
  ["4.5:1", "contrast, every hue"],
];

export function Close() {
  return (
    <section className="defer-offscreen mx-auto max-w-5xl px-6 py-32">
      <div className="border-line grid gap-px border-t sm:grid-cols-4">
        {FACTS.map(([value, label]) => (
          <div key={label} className="py-8">
            <div className="text-3xl tracking-tight">{value}</div>
            <div className="text-muted mt-1 text-xs lowercase">{label}</div>
          </div>
        ))}
      </div>

      {/*
        No install command here any more — it is in the hero, under the
        description. Repeating it would mean two copy buttons for one string,
        and the reason it moved was that this was the only place it appeared.
      */}
      <div className="mt-10 flex flex-wrap items-start gap-x-8 gap-y-4">
        <a
          href="/editor"
          className="text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors"
        >
          Open the editor
        </a>
        <a
          href="https://github.com/Alain00/blobatar"
          className="text-muted hover:text-ink text-sm underline underline-offset-4 transition-colors"
        >
          Source on GitHub
        </a>
      </div>

      <footer className="border-line text-muted mt-32 border-t pt-8 text-xs">
        MIT licensed. Every blobatar on this page was generated in your browser.
      </footer>
    </section>
  );
}
