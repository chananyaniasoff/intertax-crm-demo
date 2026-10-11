import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));
// Committed copies. GitHub Actions checks out this repo only, so the build
// cannot see canvas files that exist solely on a local PC.
const canvasRoot = path.resolve(here, "canvases");
const canvasFile = path.join(canvasRoot, "crm-modules-home.canvas.tsx");
const portalFile = path.join(canvasRoot, "client-portal.canvas.tsx");

export default defineConfig({
  base: "/intertax-crm-demo/",
  plugins: [react()],
  resolve: {
    alias: {
      "cursor/canvas": path.resolve(here, "src/cursor-canvas.tsx"),
      "@crm-demo": canvasFile,
      "@portal-demo": portalFile,
      react: path.resolve(here, "node_modules/react"),
      "react-dom": path.resolve(here, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(here, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(here, "node_modules/react/jsx-dev-runtime"),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      input: {
        main: path.resolve(here, "index.html"),
        portal: path.resolve(here, "portal.html"),
      },
    },
  },
});
