import { defineConfig } from "vite";

export default defineConfig({
  base: "/skip-count-solitaire/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
