import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "#0b0f19",
        panel: "#0f172a",
      },
      boxShadow: {
        glow: "0 0 40px -12px rgba(244,63,94,0.35)",
        glowCyan: "0 0 40px -12px rgba(34,211,238,0.35)",
      },
      keyframes: {
        spin: { to: { transform: "rotate(360deg)" } },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "spin-slow": "spin 1.1s linear infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
