import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Falls back to the system stack if the Inter variable isn't set
        // (shouldn't happen in practice - app/layout.tsx always sets it).
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // A slightly cooler, deeper near-black than stock neutral-950 -
        // matches the "not quite pure black" canvas Linear/Notion/Fantastical
        // use, which is what makes translucent white-overlay cards (bg-white/5
        // etc.) read as distinct surfaces instead of disappearing.
        app: "#08090b",
        accent: {
          // A second accent alongside emerald (used for calendar/secondary
          // actions), in the same violet family Linear uses for its brand
          // accent - keeps the palette from being monochrome-emerald.
          violet: {
            400: "#a78bfa",
            500: "#8b5cf6",
            600: "#7c3aed",
          },
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.4), 0 0 0 1px rgb(255 255 255 / 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
