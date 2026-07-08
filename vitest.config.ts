import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["pruebas/**/*.test.ts"],
    environment: "node",
    // Las pruebas de red (PROBAR_RED=1) llaman a servicios reales
    testTimeout: 30000,
  },
});
