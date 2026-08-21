import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

import { browserDefines } from "./rolldown.config.mjs"
import { cssAsString } from "./css-as-string.mjs"

export default defineConfig({
  plugins: [cssAsString],
  define: browserDefines,
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
})
