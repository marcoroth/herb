import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

const PREFIX = "\0herb-css:"
const SUFFIX = ".js"

const cssAsString = {
  name: "herb-css-as-string",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith(".css") || !importer) return null

    return `${PREFIX}${resolve(dirname(importer), source)}${SUFFIX}`
  },
  load(id: string) {
    if (!id.startsWith(PREFIX)) return null

    const path = id.slice(PREFIX.length, -SUFFIX.length)

    return `export default ${JSON.stringify(readFileSync(path, "utf8"))}`
  },
}

export default defineConfig({
  plugins: [cssAsString],
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
})
