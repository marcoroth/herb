import path from "path"
import { stat as fileExists } from "node:fs/promises"
import { ensureString } from "@herb-tools/core"

export async function ensureFile(object: any): Promise<string> {
  const string = ensureString(object)

  if (await fileExists(string)) {
    return string
  }

  throw new TypeError("Argument must be a string")
}

export function resolvePath(relativePath: string) {
  let basePath
  // Check if we"re in ESM or CJS context
  if (typeof __dirname !== "undefined") {
    // CommonJS environment
    basePath = __dirname
  } else {
    // ESM environment - need to use import.meta.url
    // This needs to be in a try/catch for bundlers and environments that don"t support it
    try {
      const { fileURLToPath } = require("url")
      const currentFileUrl = import.meta.url
      basePath = path.dirname(fileURLToPath(currentFileUrl))
    } catch {
      // Fallback for environments where neither is available
      basePath = process.cwd()
    }
  }

  return path.join(basePath, relativePath)
}
