import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const KEY = "blobatar-theme";

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** A small, persistent appearance switch shared by the landing page and editor. */
export function ThemeToggle() {
  // Start dark so prerendering and hydration agree; a saved preference is applied
  // immediately after mount and persists across the two standalone documents.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    const next: Theme = saved === "light" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }, []);

  const light = theme === "light";
  const toggle = () => {
    const next: Theme = light ? "dark" : "light";
    setTheme(next);
    apply(next);
    window.localStorage.setItem(KEY, next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${light ? "dark" : "light"} mode`}
      aria-pressed={light}
      title={`Switch to ${light ? "dark" : "light"} mode`}
      className="text-muted hover:text-ink hover:bg-line/50 rounded-lg p-1.5 transition-colors duration-150"
    >
      {light ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.72 5.28l-1.42 1.42M6.7 17.3l-1.42 1.42M18.72 18.72 17.3 17.3M6.7 6.7 5.28 5.28" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
    </svg>
  );
}
