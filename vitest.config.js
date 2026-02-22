import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      sqlite: "node:sqlite",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup/test-env.js"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
