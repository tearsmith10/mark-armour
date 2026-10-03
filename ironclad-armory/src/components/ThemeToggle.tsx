"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark switch. The initial theme is applied before hydration by the
 * inline script in the root layout — this button only flips it afterwards.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("mark-armour-theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="flex h-9 w-9 items-center justify-center border border-ink-600 text-base leading-none text-stone-400 transition-colors hover:border-blaze-500 hover:text-blaze-400"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
