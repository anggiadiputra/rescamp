import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SSR build for prerendering the public landing page (SEO).
// Outputs a single CJS module to dist-server/entry-server.cjs.
export default defineConfig({
  plugins: [react()],
  build: {
    ssr: "src/entry-server.tsx",
    outDir: "dist-server",
    rollupOptions: {
      output: {
        format: "cjs",
        entryFileNames: "entry-server.cjs",
      },
    },
  },
});
