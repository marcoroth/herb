import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
      include: ["test/**/*.test-d.ts"],
    },
  },
})
