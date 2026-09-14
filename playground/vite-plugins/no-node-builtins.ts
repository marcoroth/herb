import { createLogger } from "vite"

import type { Logger, Plugin } from "vite"

const EXTERNALIZED = /Module "(?<id>[^"]+)" has been externalized for browser compatibility, imported by "(?<importer>[^"]+)"/

/**
 * Vite only warns when something in the browser graph imports a Node.js
 * built-in, and replaces the module with a stub that throws on first property
 * access. The playground then builds green and dies at runtime the moment the
 * import is evaluated.
 */
export function noNodeBuiltins(): { customLogger: Logger, plugin: Plugin } {
  const offenders = new Set<string>()
  const customLogger = createLogger()
  const warn = customLogger.warn.bind(customLogger)

  customLogger.warn = (message, options) => {
    const match = EXTERNALIZED.exec(message)

    if (match) {
      const { id, importer } = match.groups!

      offenders.add(`${id} ← ${importer}`)
    }

    warn(message, options)
  }

  const plugin: Plugin = {
    name: "herb:no-node-builtins",

    buildEnd() {
      if (offenders.size === 0) return

      const list = [...offenders].map(offender => `  ${offender}`).join("\n")

      this.error(
        `Node.js built-ins cannot run in the browser, but they are reachable from the playground bundle:\n\n${list}\n\n` +
        `Keep Node-only code out of the entry point the playground imports, for example ` +
        `behind a "browser" export condition or a separate "/node" subpath export.`
      )
    },
  }

  return { customLogger, plugin }
}
