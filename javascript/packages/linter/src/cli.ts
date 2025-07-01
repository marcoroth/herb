import { readFileSync, statSync } from "fs"
import { resolve, join } from "path"
import { glob } from "glob"
import { parseArgs } from "util"

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
    --no-timing      hide timing information
`

  private formatOption: 'simple' | 'detailed' = 'detailed'
  private showTiming: boolean = true

  private pluralize(count: number, singular: string, plural?: string): string {
    return count === 1 ? singular : (plural || `${singular}s`)
  }

  private formatDetailedMessage(filename: string, message: any, content: string): string {
    const isError = message.severity === "error"
    const fileHeader = `${colorize(filename, "cyan")}:${colorize(colorize(`${message.location.start.line}:${message.location.start.column}`, "cyan"), "dim")}`
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
        colorize('  → ', isError ? "brightRed" : "brightYellow") :
        '    '

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
        contextLines += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      } else {
        // Make context lines gray and dimmed
        displayLine = colorize(colorize(displayLine, "gray"), "dim")
        contextLines += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      }

      if (isTargetLine) {
        const pointerPrefix = `        ${colorize('│', "gray")}`
        const pointerSpacing = ' '.repeat(column + 2)
        contextLines += `${pointerPrefix}${pointerSpacing}${pointer}\n`
      }
    }

    const highlightBackticks = (text: string): string => {
      if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
        const boldWhite = '\x1b[1m\x1b[37m'
        const reset = '\x1b[0m'
        return text.replace(/`([^`]+)`/g, `${boldWhite}$1${reset}`)
      }

      return text
    }

    const highlightedMessage = highlightBackticks(message.message)

    const width = process.stdout.columns || 80
    const topSeparator = colorize('────────┬' + '─'.repeat(Math.max(0, width - 9)), "dim")
    const bottomSeparator = colorize('────────┴' + '─'.repeat(Math.max(0, width - 9)), "dim")

    return `[${severityText}] ${highlightedMessage} (${diagnosticId})

${fileHeader}

${contextLines.trimEnd()}
`

  }

  private parseArguments() {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        format: { type: 'string' },
        simple: { type: 'boolean' },
        'no-color': { type: 'boolean' },
        'no-timing': { type: 'boolean' }
      },
      allowPositionals: true
    })

    if (values.help) {
      console.log(this.usage)
      process.exit(0)
    }

    if (values.version) {
      console.log("Versions:")
      console.log(`  ${name}@${version}, ${Herb.version}`.split(", ").join("\n  "))
      process.exit(0)
    }

    if (values.format && (values.format === "detailed" || values.format === "simple")) {
      this.formatOption = values.format
    }

    if (values.simple) {
      this.formatOption = "simple"
    }

    if (values['no-color']) {
      process.env.NO_COLOR = "1"
    }

    if (values['no-timing']) {
      this.showTiming = false
    }

    return { values, positionals }
  }

  private getFilePattern(positionals: string[]): string {
    let pattern = positionals.length > 0 ? positionals[0] : "**/*.html.erb"

    try {
      const stat = statSync(pattern)
      if (stat.isDirectory()) {
        pattern = join(pattern, "**/*.html.erb")
      }
    } catch {
      // Not a file/directory, treat as glob pattern
    }

    return pattern
  }

  private async processFiles(files: string[]): Promise<{
    totalErrors: number,
    totalWarnings: number,
    filesWithIssues: number,
    ruleCount: number,
    allMessages: Array<{filename: string, message: any, content: string}>,
    ruleViolations: Map<string, { count: number, files: Set<string> }>
  }> {
    let totalErrors = 0
    let totalWarnings = 0
    let filesWithIssues = 0
    let ruleCount = 0
    const allMessages: Array<{filename: string, message: any, content: string}> = []
    const ruleViolations = new Map<string, { count: number, files: Set<string> }>()

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

      // Get rule count on first file
      if (ruleCount === 0) {
        ruleCount = linter.getRuleCount()
      }

      if (lintResult.messages.length === 0) {
        if (files.length === 1) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        // Collect messages for later display
        for (const message of lintResult.messages) {
          allMessages.push({ filename, message, content })

          const ruleData = ruleViolations.get(message.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleViolations.set(message.rule, ruleData)
        }

        if (this.formatOption === 'simple') {
          console.log("")
          this.displaySimpleFormat(filename, lintResult.messages)
        }

        totalErrors += lintResult.errors
        totalWarnings += lintResult.warnings
        filesWithIssues++
      }
    }

    return { totalErrors, totalWarnings, filesWithIssues, ruleCount, allMessages, ruleViolations }
  }

  private displaySimpleFormat(filename: string, messages: any[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const message of messages) {
      const isError = message.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${message.rule})`, "blue")
      const locationString = `${message.location.start.line}:${message.location.start.column}`
      const paddedLocation = locationString.padEnd(4) // Pad to 4 characters for alignment

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${message.message} ${rule}`)
    }

    console.log() // Add newline after each file
  }

  private displayDetailedFormat(allMessages: Array<{filename: string, message: any, content: string}>): void {
    if (this.formatOption === 'detailed' && allMessages.length > 0) {
      const totalMessageCount = allMessages.length
      for (let i = 0; i < allMessages.length; i++) {
        const { filename, message, content } = allMessages[i]
        console.log(`\n${this.formatDetailedMessage(filename, message, content)}`)

        const width = process.stdout.columns || 80
        const progressText = `[${i + 1}/${totalMessageCount}]`
        const rightPadding = 16
        const separatorLength = Math.max(0, width - progressText.length - 1 - rightPadding)
        const separator = '⎯'
        const leftSeparator = colorize(separator.repeat(separatorLength), "gray")
        const rightSeparator = colorize(separator.repeat(4), "gray")
        const progress = colorize(progressText, "gray")

        console.log(colorize(`${leftSeparator}  ${progress}`, "dim") + colorize(` ${rightSeparator}\n`, "dim"))
      }
    }
  }

  private displayMostViolatedRules(ruleViolations: Map<string, { count: number, files: Set<string> }>, limit: number = 5): void {
    if (ruleViolations.size === 0) return

    const allRules = Array.from(ruleViolations.entries()).sort((a, b) => b[1].count - a[1].count)
    const displayedRules = allRules.slice(0, limit)
    const remainingRules = allRules.slice(limit)

    const title = ruleViolations.size <= limit ? "Rule violations:" : "Most violated rules:"
    console.log(` ${colorize(title, "bold")}`)

    for (const [rule, data] of displayedRules) {
      const fileCount = data.files.size
      const countText = `(${data.count} ${this.pluralize(data.count, "violation")} in ${fileCount} ${this.pluralize(fileCount, "file")})`
      console.log(`  ${colorize(rule, "gray")} ${colorize(colorize(countText, "gray"), "dim")}`)
    }

    if (remainingRules.length > 0) {
      const remainingViolationCount = remainingRules.reduce((sum, [_, data]) => sum + data.count, 0)
      const remainingRuleCount = remainingRules.length
      console.log(colorize(colorize(`\n  ...and ${remainingRuleCount} more ${this.pluralize(remainingRuleCount, "rule")} with ${remainingViolationCount} ${this.pluralize(remainingViolationCount, "violation")}`, "gray"), "dim"))
    }
  }

  private displaySummary(files: string[], totalErrors: number, totalWarnings: number, filesWithViolations: number, ruleCount: number, startTime: number, startDate: Date): void {
    console.log("\n")
    console.log(` ${colorize("Summary:", "bold")}`)

    // Calculate padding for alignment
    const labelWidth = 12 // Width for the longest label "Violations"
    const pad = (label: string) => label.padEnd(labelWidth)

    // Checked summary
    console.log(`  ${colorize(pad("Checked"), "gray")} ${colorize(`${files.length} ${this.pluralize(files.length, "file")}`, "cyan")}`)

    // Files summary (for multiple files)
    if (files.length > 1) {
      const filesChecked = files.length
      const filesClean = filesChecked - filesWithViolations

      let filesSummary = ""
      let shouldDim = false

      if (filesWithViolations > 0) {
        filesSummary = `${colorize(colorize(`${filesWithViolations} with violations`, "brightRed"), "bold")} | ${colorize(colorize(`${filesClean} clean`, "green"), "bold")} ${colorize(colorize(`(${filesChecked} total)`, "gray"), "dim")}`
      } else {
        filesSummary = `${colorize(colorize(`${filesChecked} clean`, "green"), "bold")} ${colorize(colorize(`(${filesChecked} total)`, "gray"), "dim")}`
        shouldDim = true
      }

      if (shouldDim) {
        console.log(colorize(`  ${colorize(pad("Files"), "gray")} ${filesSummary}`, "dim"))
      } else {
        console.log(`  ${colorize(pad("Files"), "gray")} ${filesSummary}`)
      }
    }

    // Violations summary with file count
    let violationsSummary = ""
    const parts = []

    // Build the main part with errors and warnings
    if (totalErrors > 0) {
      parts.push(colorize(colorize(`${totalErrors} ${this.pluralize(totalErrors, "error")}`, "brightRed"), "bold"))
    }

    if (totalWarnings > 0) {
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "brightYellow"), "bold"))
    } else if (totalErrors > 0) {
      // Show 0 warnings when there are errors but no warnings
      parts.push(colorize(colorize(`${totalWarnings} ${this.pluralize(totalWarnings, "warning")}`, "green"), "bold"))
    }

    if (parts.length === 0) {
      violationsSummary = colorize(colorize("0 violations", "green"), "bold")
    } else {
      violationsSummary = parts.join(" | ")
      // Add total count and file count
      let detailText = ""

      const totalViolations = totalErrors + totalWarnings

      if (filesWithViolations > 0) {
        detailText = `${totalViolations} ${this.pluralize(totalViolations, "violation")} across ${filesWithViolations} ${this.pluralize(filesWithViolations, "file")}`
      }

      violationsSummary += ` ${colorize(colorize(`(${detailText})`, "gray"), "dim")}`
    }

    console.log(`  ${colorize(pad("Violations"), "gray")} ${violationsSummary}`)

    // Timing information (if enabled)
    if (this.showTiming) {
      const duration = Date.now() - startTime
      const timeString = startDate.toTimeString().split(' ')[0] // HH:MM:SS format

      console.log(`  ${colorize(pad("Start at"), "gray")} ${colorize(timeString, "cyan")}`)
      console.log(`  ${colorize(pad("Duration"), "gray")} ${colorize(`${duration}ms`, "cyan")} ${colorize(colorize(`(${ruleCount} ${this.pluralize(ruleCount, "rule")})`, "gray"), "dim")}`)
    }

    // Success message for all files clean
    if (filesWithViolations === 0 && files.length > 1) {
      console.log("")
      console.log(` ${colorize("✓", "brightGreen")} ${colorize("All files are clean!", "green")}`)
    }
  }

  async run() {
    const startTime = Date.now()
    const startDate = new Date()

    const { positionals } = this.parseArguments()

    try {
      await Herb.load()

      const pattern = this.getFilePattern(positionals)

      // Validate that we have a proper file pattern
      if (positionals.length === 0) {
        console.error("Please specify input file.")
        process.exit(1)
      }

      const files = await glob(pattern)

      if (files.length === 0) {
        console.log(`No files found matching pattern: ${pattern}`)
        process.exit(0)
      }

      const results = await this.processFiles(files)
      const { totalErrors, totalWarnings, filesWithIssues, ruleCount, allMessages, ruleViolations } = results

      this.displayDetailedFormat(allMessages)
      this.displayMostViolatedRules(ruleViolations)
      this.displaySummary(files, totalErrors, totalWarnings, filesWithIssues, ruleCount, startTime, startDate)

      if (totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      console.error(`Error:`, error)
      process.exit(1)
    }
  }
}
