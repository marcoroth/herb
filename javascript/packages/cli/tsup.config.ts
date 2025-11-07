import { defineConfig } from "tsup"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"))

export default defineConfig({
  format: ["esm"],
  clean: true,
  minify: true,
  entry: ["src/index.ts"],
  shims: true,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  define: {
    "__VERSION__": JSON.stringify(packageJson.version)
  }
})
