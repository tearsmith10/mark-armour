import type { Config } from "tailwindcss";

/**
 * Theme-aware palette: ink / olive / stone / red resolve through CSS
 * component variables (rgb channels + <alpha-value>) so every utility —
 * including opacity modifiers like bg-ink-950/90 — flips instantly with
 * [data-theme="light"] on <html>. Blaze (the brand accent) stays constant.
 */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: v("--c-ink-950"),
          900: v("--c-ink-900"),
          850: v("--c-ink-850"),
          800: v("--c-ink-800"),
          700: v("--c-ink-700"),
          600: v("--c-ink-600"),
        },
        olive: {
          300: v("--c-olive-300"),
          400: v("--c-olive-400"),
          500: v("--c-olive-500"),
          600: v("--c-olive-600"),
          700: v("--c-olive-700"),
        },
        blaze: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        // constant near-black for text on blaze/olive fills (both themes)
        onbrand: "rgb(var(--c-onbrand) / <alpha-value>)",
        stone: {
          100: v("--c-stone-100"),
          200: v("--c-stone-200"),
          300: v("--c-stone-300"),
          400: v("--c-stone-400"),
          500: v("--c-stone-500"),
          600: v("--c-stone-600"),
        },
        red: {
          300: v("--c-red-300"),
          400: v("--c-red-400"),
          500: v("--c-red-500"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        glow: "var(--shadow-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
