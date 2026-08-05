import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

// https://vitest.dev/guide/browser/playwright

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
})
