import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE can be overridden at build time:
//   VITE_BASE=/nexora/  -> GitHub Pages under user/nexora
//   VITE_BASE=/         -> custom domain apex
// Default matches the GitHub Pages project URL.
const base = process.env.VITE_BASE || "/nexora/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
