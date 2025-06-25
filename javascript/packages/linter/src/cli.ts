import { readFileSync, statSync } from "fs"
import { resolve, join } from "path"
import { glob } from "glob"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "./linter.js"

import { name, version } from "../package.json"

export class CLI {
  private usage = `
  Usage: herb-lint [file|glob-pattern|directory] [options]

  Arguments:
    file             Single file to lint
    glob-pattern     Files to lint (defaults to **/*.html.erb)
    directory        Directory to lint (automatically appends **/*.html.erb)

  Options:
    -h, --help       show help
    -v, --version    show version
`

  async run() {
    const args = process.argv.slice(2)

    if (args.includes("--help") || args.includes("-h")) {
      console.log(this.usage)
      process.exit(0)
    }

    try {
      await Herb.load()

      if (args.includes("--version") || args.includes("-v")) {
        console.log("Versions:")
        console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
        process.exit(0)
      }

      let pattern = args.length > 0 && !args[0].startsWith("-") ? args[0] : "**/*.html.erb"
      
      // Check if the pattern is a directory and auto-append glob pattern
      try {
        const stat = statSync(pattern)
        if (stat.isDirectory()) {
          pattern = join(pattern, "**/*.html.erb")
        }
      } catch {
        // Not a file/directory, treat as glob pattern
      }
      
      const files = await glob(pattern)

      if (files.length === 0) {
        console.log(`No files found matching pattern: ${pattern}`)
        process.exit(0)
      }

      let totalErrors = 0
      let totalWarnings = 0
      let filesWithIssues = 0

      for (const filename of files) {
        const filePath = resolve(filename)
        const content = readFileSync(filePath, "utf-8")

        const parseResult = Herb.parse(content)

        if (parseResult.errors.length > 0) {
          console.error(`${filename} - Parse errors:`)

          for (const error of parseResult.errors) {
            console.error(`  ${error.message}`)
          }

          totalErrors++
          filesWithIssues++
          continue
        }

        const linter = new Linter()
        const lintResult = linter.lint(parseResult.value)

        if (lintResult.messages.length === 0) {
          console.log(`✓ ${filename} - No issues found`)
        } else {
          console.log(`${filename}:`)

          for (const message of lintResult.messages) {
            const severity = message.severity === "error" ? "✗" : "⚠"
            const location = `${message.location.start.line}:${message.location.start.column}`
            console.log(`  ${location} ${severity} ${message.message} (${message.rule})`)
          }

          totalErrors += lintResult.errors
          totalWarnings += lintResult.warnings
          filesWithIssues++
        }
      }

      console.log("")
      console.log(`Checked ${files.length} file(s)`)
      console.log(`${totalErrors} error(s), ${totalWarnings} warning(s) across ${filesWithIssues} file(s)`)

      if (totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      console.error(`Error:`, error)
      process.exit(1)
    }
  }
}
