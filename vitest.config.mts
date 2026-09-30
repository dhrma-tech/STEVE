import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    clearMocks: true,
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-db.ts"],
    testTimeout: 20000
  }
});
