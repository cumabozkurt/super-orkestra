import { defineConfig } from "vitest/config";
export default defineConfig({ test: { setupFiles: ["tests/setup.ts"], include: ["tests/**/*.test.ts"],
  // Testler gerçek git depoları ve alt süreçler açar; Windows/macOS CI makinelerinde 5 sn varsayılanı yetmeyebiliyor.
  testTimeout: 30_000, hookTimeout: 30_000 } });
