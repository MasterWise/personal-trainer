import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/pt/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api/pt": {
        target: "http://localhost:3400",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pt/, "/api"),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
