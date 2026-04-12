import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      sqlite: "node:sqlite",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js", "tests/**/*.test.jsx"],
    setupFiles: ["tests/setup/test-env.js"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
