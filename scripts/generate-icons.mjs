#!/usr/bin/env node
/**
 * Gera os PNGs da PWA a partir de public/icons/icon.svg.
 *
 * Saídas em public/icons/:
 *   icon-192.png             192x192, purpose "any"
 *   icon-512.png             512x512, purpose "any"
 *   icon-512-maskable.png    512x512, purpose "maskable" (safe-zone 80% com background)
 *   apple-touch-icon.png     180x180, para iOS Safari (Add to Home Screen)
 *
 * Uso: `npm run icons:generate` (executar manualmente quando icon.svg mudar).
 * Documentado em AGENTS.md — não roda em prebuild para não atrasar `npm run build`.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const iconsDir = join(projectRoot, "public", "icons");
const sourceSvg = join(iconsDir, "icon.svg");

// Cor de fundo do maskable icon — combina com theme_color do manifest
// para garantir continuidade visual quando Android aplica a máscara adaptativa.
const MASKABLE_BG = { r: 184, g: 120, b: 80, alpha: 1 }; // #B87850
const MASKABLE_SAFE_ZONE = 0.8; // ícone ocupa 80% — sobra 10% de borda em cada lado

mkdirSync(iconsDir, { recursive: true });
const svgBuffer = readFileSync(sourceSvg);

async function renderSquarePng({ size, outPath }) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}×${size})`);
}

async function renderMaskablePng({ size, outPath }) {
  const safeSize = Math.round(size * MASKABLE_SAFE_ZONE);
  const inner = await sharp(svgBuffer, { density: 384 })
    .resize(safeSize, safeSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BG,
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}×${size}, maskable safe-zone ${MASKABLE_SAFE_ZONE * 100}%)`);
}

async function main() {
  console.log(`[generate-icons] Fonte: ${sourceSvg}`);
  await renderSquarePng({ size: 192, outPath: join(iconsDir, "icon-192.png") });
  await renderSquarePng({ size: 512, outPath: join(iconsDir, "icon-512.png") });
  await renderMaskablePng({ size: 512, outPath: join(iconsDir, "icon-512-maskable.png") });
  await renderSquarePng({ size: 180, outPath: join(iconsDir, "apple-touch-icon.png") });
  console.log("[generate-icons] Concluido.");
}

main().catch((err) => {
  console.error("[generate-icons] Falhou:", err);
  process.exit(1);
});
