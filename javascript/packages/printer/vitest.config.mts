import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    isolate: false,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
      include: ["test/**/*.test-d.ts"],
    },
  },
})
