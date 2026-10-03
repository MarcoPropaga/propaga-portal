import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/regras-banco/**/*.test.ts"], testTimeout: 20000 } });
