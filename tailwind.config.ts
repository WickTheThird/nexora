import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F7F8FA",
          100: "#EEF1F5",
          200: "#D9DFE7",
          300: "#B8C2CF",
          400: "#8A98AA",
          500: "#5D6B7F",
          600: "#3F4B5E",
          700: "#2A3547",
          800: "#1A2332",
          900: "#0F1722",
          950: "#0A121C",
        },
        accent: {
          50: "#FFF8EB",
          100: "#FFECC7",
          200: "#FFD88A",
          300: "#FFBD4D",
          400: "#FFA621",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 34, 0.04), 0 4px 16px rgba(15, 23, 34, 0.06)",
        elev: "0 4px 12px rgba(15, 23, 34, 0.08), 0 12px 36px rgba(15, 23, 34, 0.10)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
