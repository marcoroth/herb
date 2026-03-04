import { defineConfig } from "vitest/config"
import { yaml } from "./yaml-plugin.mjs"

export default defineConfig({
  plugins: [yaml()],
  test: {}
})
