import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
