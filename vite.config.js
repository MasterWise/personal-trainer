import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Base path resolution (em ordem de prioridade):
//   1. process.env.VITE_BASE_PATH (export no shell)
//   2. VITE_BASE_PATH carregado do .env / .env.production / .env.local (via loadEnv)
//   3. Default: "/pt/" (preserva comportamento de dev local via Caddy proxy)
// Produção Firebase Hosting serve em "/" — `.env.production` versionado tem
// VITE_BASE_PATH=/ pra que `vite build` saia com paths absolutos corretos.

/**
 * Plugin que substitui o placeholder `__BASE__` por `base` resolvido em
 * `dist/manifest.json` e `dist/sw.js` após o `vite build` concluir.
 *
 * Vite só substitui `%BASE_URL%` automaticamente em `index.html`; arquivos
 * em `public/` são copiados as-is. Sem este plugin, o manifest e o SW em
 * produção continuariam apontando para `/pt/...` mesmo com `VITE_BASE_PATH=/`,
 * mantendo o bug que esta sprint corrige.
 *
 * Em dev (`vite dev`) o `closeBundle` não roda — arquivos da `public/` são
 * servidos com `__BASE__` literal, e ícones falham. Aceitável: PWA validation
 * completa só faz sentido contra prod build.
 */
function pwaBaseTransform(base) {
  return {
    name: "pwa-base-transform",
    apply: "build",
    closeBundle() {
      const outDir = resolve("dist");
      for (const filename of ["manifest.json", "sw.js"]) {
        const full = resolve(outDir, filename);
        if (!existsSync(full)) continue;
        const original = readFileSync(full, "utf8");
        const replaced = original.replaceAll("__BASE__", base);
        if (replaced !== original) {
          writeFileSync(full, replaced);
          console.log(`[pwa-base-transform] ${filename}: __BASE__ -> "${base}"`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/pt/";

  return {
    base,
    plugins: [react(), pwaBaseTransform(base)],
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
