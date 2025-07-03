import { readFileSync, statSync } from "fs"
import { resolve, join } from "path"
import { glob } from "glob"
import { parseArgs } from "util"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "./linter.js"

import { name, version } from "../package.json"
import { colorize, Highlighter } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"

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
    allDiagnostics: Array<{filename: string, diagnostic: Diagnostic, content: string}>,
    ruleViolations: Map<string, { count: number, files: Set<string> }>
  }> {
    let totalErrors = 0
    let totalWarnings = 0
    let filesWithIssues = 0
    let ruleCount = 0
    const allDiagnostics: Array<{filename: string, diagnostic: Diagnostic, content: string}> = []
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

      if (lintResult.offenses.length === 0) {
        if (files.length === 1) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        // Collect messages for later display
        for (const offense of lintResult.offenses) {
          allDiagnostics.push({ filename, diagnostic: offense, content })

          const ruleData = ruleViolations.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleViolations.set(offense.rule, ruleData)
        }

        if (this.formatOption === 'simple') {
          console.log("")
          this.displaySimpleFormat(filename, lintResult.offenses)
        }

        totalErrors += lintResult.errors
        totalWarnings += lintResult.warnings
        filesWithIssues++
      }
    }

    return { totalErrors, totalWarnings, filesWithIssues, ruleCount, allDiagnostics, ruleViolations }
  }

  private displaySimpleFormat(filename: string, diagnostics: Diagnostic[]): void {
    console.log(`${colorize(filename, "cyan")}:`)

    for (const diagnostic of diagnostics) {
      const isError = diagnostic.severity === "error"
      const severity = isError ? colorize("✗", "brightRed") : colorize("⚠", "brightYellow")
      const rule = colorize(`(${diagnostic.code})`, "blue")
      const locationString = `${diagnostic.location.start.line}:${diagnostic.location.start.column}`
      const paddedLocation = locationString.padEnd(4) // Pad to 4 characters for alignment

      console.log(`  ${colorize(paddedLocation, "gray")} ${severity} ${diagnostic.message} ${rule}`)
    }

    console.log() // Add newline after each file
  }

  private async displayDetailedFormat(
    allDiagnostics: Array<{filename: string, diagnostic: Diagnostic, content: string}>,
    isSingleFile: boolean = false
  ): Promise<void> {
    if (this.formatOption === 'detailed' && allDiagnostics.length > 0) {
      if (isSingleFile) {
        // For single file, use inline diagnostics with syntax highlighting
        const { filename, content } = allDiagnostics[0]
        const diagnostics = allDiagnostics.map(item => item.diagnostic)

        const highlighter = new Highlighter('default')
        await highlighter.initialize()

        const highlighted = highlighter.highlight(filename, content, {
          diagnostics: diagnostics,
          splitDiagnostics: true, // Use split mode to show each diagnostic separately
          contextLines: 2
        })

        console.log(`\n${highlighted}`)
      } else {
        // For multiple files, show individual diagnostics with syntax highlighting
        const highlighter = new Highlighter('default')
        await highlighter.initialize()

        const totalMessageCount = allDiagnostics.length
        for (let i = 0; i < allDiagnostics.length; i++) {
          const { filename, diagnostic, content } = allDiagnostics[i]
          const formatted = highlighter.highlightDiagnostic(filename, diagnostic, content, { contextLines: 2 })
          console.log(`\n${formatted}`)

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
      const { totalErrors, totalWarnings, filesWithIssues, ruleCount, allDiagnostics, ruleViolations } = results

      await this.displayDetailedFormat(allDiagnostics, files.length === 1)
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
