import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test-utils/tenancy-mock-setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 20,
        branches: 15,
        functions: 20,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only throws outside Next.js server context -- stub it for Vitest
      "server-only": path.resolve(
        __dirname,
        "./src/test-utils/server-only-stub.ts",
      ),
    },
  },
});
