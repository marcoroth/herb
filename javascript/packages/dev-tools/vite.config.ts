import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"

import { browserDefines } from "./rolldown.config.mjs"
import { cssAsString } from "./css-as-string.mjs"

const packageRoot = fileURLToPath(new URL(".", import.meta.url))
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url))

const DEFAULT_PORT = 5212

const entry = process.env.HERB_DEMO_TARGET === "dist"
  ? "dist/herb-dev-tools.esm.js"
  : "src/index.ts"

export default defineConfig({
  root: `${packageRoot}demo`,
  plugins: [cssAsString],
  define: browserDefines,
  resolve: {
    alias: {
      "@herb-tools/dev-tools": `${packageRoot}${entry}`,
    },
  },
  server: {
    port: Number(process.env.HERB_DEMO_PORT ?? DEFAULT_PORT),
    fs: {
      allow: [workspaceRoot],
    },
  },
})
