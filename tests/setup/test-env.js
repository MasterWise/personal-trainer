import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir;

export function setupTestEnv() {
  tempDir = mkdtempSync(join(tmpdir(), "pt-test-"));
  process.env.DATABASE_PATH = join(tempDir, "test.sqlite");
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5174";
}

export function cleanupTestEnv() {
  if (tempDir) {
    try { rmSync(tempDir, { recursive: true }); } catch { /* ignore */ }
  }
}

export { tempDir };
