import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        board: {
          bg: "#262421",
          panel: "#302e2b",
          border: "#3d3a37",
          hover: "#3a3835",
          light: "#ebecd0",
          dark: "#779556",
        },
        accent: {
          DEFAULT: "#81b64c",
          muted: "#6a9a3e",
          gold: "#f0c040",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      animation: {
        "capture-burst": "captureBurst 0.45s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        captureBurst: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.3)", opacity: "0.8" },
          "100%": { transform: "scale(0)", opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(129, 182, 76, 0.35)" },
          "50%": { boxShadow: "0 0 16px 2px rgba(129, 182, 76, 0.2)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
