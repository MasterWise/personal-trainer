import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Base path resolution (em ordem de prioridade):
//   1. process.env.VITE_BASE_PATH (export no shell)
//   2. VITE_BASE_PATH carregado do .env / .env.production / .env.local (via loadEnv)
//   3. Default: "/pt/" (preserva comportamento de dev local via Caddy proxy)
// Produção Firebase Hosting serve em "/" — `.env.production` versionado tem
// VITE_BASE_PATH=/ pra que `vite build` saia com paths absolutos corretos.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/pt/";

  return {
    base,
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
  };
});
