import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const PREFIX = "\0herb-css:"
const SUFFIX = ".js"

export const cssAsString = {
  name: "herb-css-as-string",
  enforce: "pre",
  resolveId(source, importer) {
    if (!source.endsWith(".css") || source.includes("?") || !importer) return null
    if (!source.startsWith(".") && !source.startsWith("/")) return null

    return `${PREFIX}${resolve(dirname(importer), source)}${SUFFIX}`
  },
  load(id) {
    if (!id.startsWith(PREFIX)) return null

    const path = id.slice(PREFIX.length, -SUFFIX.length)

    return `export default ${JSON.stringify(readFileSync(path, "utf8"))}`
  },
}
