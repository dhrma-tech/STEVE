"use client";

import * as React from "react";

function SunIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth="1.8" />
      <path strokeLinecap="round" strokeWidth="1.8" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    // Use classList to avoid wiping other classes on <html>
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    // Persist preference in cookie (1 year)
    document.cookie = `theme-preference=${next ? "dark" : "light"};path=/;max-age=31536000;samesite=lax`;
    setIsDark(next);
  }

  if (isDark === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="pointer-events-auto grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] outline-none transition-colors hover:bg-[var(--foreground-10)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
