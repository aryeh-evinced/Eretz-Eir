import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f1a",
        surface: "#1a1a2e",
        "surface-2": "#222240",
        accent: "#e94560",
        "accent-glow": "rgba(233, 69, 96, 0.3)",
        gold: "#f5c842",
        "gold-glow": "rgba(245, 200, 66, 0.3)",
        teal: "#0ff0b3",
        "teal-glow": "rgba(15, 240, 179, 0.2)",
        "text-primary": "#eaeaea",
        "text-dim": "#8888a8",
        border: "#2a2a4a",
        "input-bg": "#16162b",
      },
      fontFamily: {
        body: ["var(--font-heebo)", "Heebo", "sans-serif"],
        display: ["var(--font-rubik)", "Rubik", "sans-serif"],
      },
      borderRadius: {
        game: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
