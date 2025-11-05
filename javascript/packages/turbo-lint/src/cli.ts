import { Herb } from "@herb-tools/node-wasm"
import { TurboLinter } from "./linter.js"
import { defaultRules } from "./default-rules.js"

export class CLI {
  async run() {
    console.log("Turbo Lint CLI")

    const args = process.argv.slice(2)

    if (args.length === 0) {
      console.log("Usage: turbo-lint <file>")
      process.exit(1)
    }

    const filePath = args[0]

    // Load the Herb backend
    await Herb.load()

    const linter = new TurboLinter(Herb, defaultRules)

    try {
      const result = await linter.lintFile(filePath)

      console.log(`\nFound ${result.errors} errors and ${result.warnings} warnings\n`)

      for (const offense of result.offenses) {
        console.log(`${filePath} - ${offense.severity}: ${offense.message} (${offense.rule})`)
      }

      process.exit(result.errors > 0 ? 1 : 0)
    } catch (error) {
      console.error("Error:", error)
      process.exit(1)
    }
  }
}
