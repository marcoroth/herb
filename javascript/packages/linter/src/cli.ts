import { readFileSync, statSync } from "fs"
import { resolve, join } from "path"
import { glob } from "glob"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "./linter.js"

import { name, version } from "../package.json"
import { colorize } from "./color.js"

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
    --format         output format (simple|detailed) [default: detailed]
    --simple         use simple output format (shortcut for --format simple)
    --no-color       disable colored output
`

  private formatOption: 'simple' | 'detailed' = 'detailed'

  private formatDetailedMessage(filename: string, message: any, content: string): string {
    const isError = message.severity === "error"
    const location = colorize(`${filename}:${message.location.start.line}:${message.location.start.column}`, "cyan")
    const severityText = isError ? colorize("error", "brightRed") : colorize("warning", "brightYellow")
    const diagnosticId = colorize(message.rule, "gray")

    const lines = content.split('\n')
    const targetLineNumber = message.location.start.line
    const column = message.location.start.column - 1
    const pointer = colorize('~'.repeat(Math.max(1, (message.location.end?.column || message.location.start.column + 1) - message.location.start.column)), isError ? "brightRed" : "brightYellow")

    const aroundLines = 2
    const startLine = Math.max(1, targetLineNumber - aroundLines)
    const endLine = Math.min(lines.length, targetLineNumber + aroundLines)

    let contextLines = ''

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1] || ''
      const isTargetLine = i === targetLineNumber
      const lineNumber = isTargetLine ?
        colorize(i.toString().padStart(3, ' '), "bold") :
        colorize(i.toString().padStart(3, ' '), "gray")

      const prefix = isTargetLine ?
        colorize('│ → ', isError ? "brightRed" : "brightYellow") :
        colorize('│   ', "gray")

      const separator = colorize('│', "gray")

      let displayLine = line

      if (isTargetLine) {
        const startCol = message.location.start.column
        const endCol = message.location.end?.column ? message.location.end.column : message.location.start.column + 1
        const before = line.substring(0, startCol)
        const errorText = line.substring(startCol, endCol)
        const after = line.substring(endCol)
        const boldWhite = '\x1b[1m\x1b[37m'
        const reset = '\x1b[0m'
        const highlightedError = process.stdout.isTTY && process.env.NO_COLOR === undefined ?
          `${boldWhite}${errorText}${reset}` : errorText
        displayLine = before + highlightedError + after
      }

      contextLines += `${prefix}${lineNumber} ${separator} ${displayLine}\n`

      if (isTargetLine) {
        const pointerPrefix = colorize('│       │', "gray")
        const pointerSpacing = ' '.repeat(column + 2)
        contextLines += `${pointerPrefix}${pointerSpacing}${pointer}\n`
      }
    }

    const borderColor = "gray"

    const highlightBackticks = (text: string): string => {
      if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
        const boldWhite = '\x1b[1m\x1b[37m'
        const reset = '\x1b[0m'
        return text.replace(/`([^`]+)`/g, `${boldWhite}$1${reset}`)
      }

      return text
    }

    const highlightedMessage = highlightBackticks(message.message)

    return `${location} - ${severityText} ${diagnosticId}: ${highlightedMessage}
${colorize('│', borderColor)}
${contextLines.trimEnd()}`
  }

  async run() {
    const args = process.argv.slice(2)

    if (args.includes("--help") || args.includes("-h")) {
      console.log(this.usage)
      process.exit(0)
    }

    const formatIndex = args.indexOf("--format")

    if (formatIndex !== -1 && formatIndex + 1 < args.length) {
      const formatValue = args[formatIndex + 1]

      if (formatValue === "detailed" || formatValue === "simple") {
        this.formatOption = formatValue
      }
    }

    if (args.includes("--simple")) {
      this.formatOption = "simple"
    }

    if (args.includes("--no-color")) {
      process.env.NO_COLOR = "1"
    }

    try {
      await Herb.load()

      if (args.includes("--version") || args.includes("-v")) {
        console.log("Versions:")
        console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))

        process.exit(0)
      }

      const filteredArgs = []

      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--format") {
          i++
        } else if (args[i] === "--no-color" || args[i] === "--simple" || args[i].startsWith("-")) {
          // Skip flags
        } else {
          filteredArgs.push(args[i])
        }
      }

      let pattern = filteredArgs.length > 0 ? filteredArgs[0] : "**/*.html.erb"

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
          console.error(`${colorize(filename, "cyan")} - ${colorize("Parse errors:", "brightRed")}`)

          for (const error of parseResult.errors) {
            console.error(`  ${colorize("✗", "brightRed")} ${error.message}`)
          }

          totalErrors++
          filesWithIssues++
          continue
        }

        const linter = new Linter()
        const lintResult = linter.lint(parseResult.value)

        if (lintResult.messages.length === 0) {
          if (files.length === 1) {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
          }
        } else {
          if (this.formatOption === 'detailed') {
            for (const message of lintResult.messages) {
              console.log(`${this.formatDetailedMessage(filename, message, content)}\n`)
            }
          } else {
            console.log(`${colorize(filename, "cyan")}:`)

            for (const message of lintResult.messages) {
              const isError = message.severity === "error"
              const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
              const rule = colorize(`(${message.rule})`, "blue")
              const locationStr = `${message.location.start.line}:${message.location.start.column}`
              const paddedLocation = locationStr.padEnd(4) // Pad to 4 characters for alignment

              console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${message.message} ${rule}`)
            }
          }

          totalErrors += lintResult.errors
          totalWarnings += lintResult.warnings
          filesWithIssues++
        }
      }

      console.log("")

      if (files.length === 1) {
        const errorText = totalErrors > 0 ? colorize(`${totalErrors} error(s)`, "brightRed") : colorize(`${totalErrors} error(s)`, "green")
        const warningText = totalWarnings > 0 ? colorize(`${totalWarnings} warning(s)`, "brightYellow") : colorize(`${totalWarnings} warning(s)`, "green")

        console.log(`${errorText}, ${warningText}`)
      } else {
        console.log(`${colorize("Checked", "gray")} ${colorize(files.length.toString(), "cyan")} ${colorize("file(s)", "gray")}`)

        const errorText = totalErrors > 0 ? colorize(`${totalErrors} error(s)`, "brightRed") : colorize(`${totalErrors} error(s)`, "green")
        const warningText = totalWarnings > 0 ? colorize(`${totalWarnings} warning(s)`, "brightYellow") : colorize(`${totalWarnings} warning(s)`, "green")
        const filesText = filesWithIssues > 0 ? colorize(`${filesWithIssues} file(s)`, "yellow") : colorize(`${filesWithIssues} file(s)`, "green")

        console.log(`${errorText}, ${warningText} across ${filesText}`)

        if (filesWithIssues === 0) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize("All files passed!", "green")}`)
        }
      }

      if (totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      console.error(`Error:`, error)
      process.exit(1)
    }
  }
}
