import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/lib/config": resolve(__dirname, "./src/lib/config"),
      "@/lib/currency": resolve(__dirname, "./src/lib/currency.ts"),
      "@/lib/entitlements": resolve(__dirname, "./src/lib/entitlements.ts"),
      "@/lib/logger": resolve(__dirname, "./src/lib/logger.ts"),
      "@/": resolve(__dirname, "./src/"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
