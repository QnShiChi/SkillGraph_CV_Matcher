import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          dark: "var(--color-brand-dark)",
          deep: "var(--color-brand-deep)",
          subtle: "var(--color-brand-subtle)",
        },
      },
      boxShadow: {
        whisper: "var(--shadow-whisper)",
        micro: "var(--shadow-micro)",
      },
      borderRadius: {
        brand: "var(--radius-brand)",
      },
      fontFamily: {
        display: ["Inter", "Helvetica", "Arial", "sans-serif"],
        body: ["Inter", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
