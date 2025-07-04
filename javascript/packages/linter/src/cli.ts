import { glob } from "glob"
import { Herb } from "@herb-tools/node-wasm"
import { ArgumentParser } from "./cli/argument-parser.js"
import { FileProcessor } from "./cli/file-processor.js"
import { SimpleFormatter, DetailedFormatter } from "./cli/formatters/index.js"
import { SummaryReporter } from "./cli/summary-reporter.js"

export class CLI {
  private argumentParser = new ArgumentParser()
  private fileProcessor = new FileProcessor()
  private summaryReporter = new SummaryReporter()

  async run() {
    const startTime = Date.now()
    const startDate = new Date()

    const { pattern, formatOption, showTiming, theme, wrapLines } = this.argumentParser.parse(process.argv)

    try {
      await Herb.load()

      const files = await glob(pattern)

      if (files.length === 0) {
        console.log(`No files found matching pattern: ${pattern}`)
        process.exit(0)
      }

      const results = await this.fileProcessor.processFiles(files)
      const { totalErrors, totalWarnings, filesWithIssues, ruleCount, allDiagnostics, ruleViolations } = results

      const formatter = formatOption === 'simple'
        ? new SimpleFormatter()
        : new DetailedFormatter(theme, wrapLines)

      await formatter.format(allDiagnostics, files.length === 1)

      this.summaryReporter.displayMostViolatedRules(ruleViolations)
      this.summaryReporter.displaySummary({
        files,
        totalErrors,
        totalWarnings,
        filesWithViolations: filesWithIssues,
        ruleCount,
        startTime,
        startDate,
        showTiming,
        ruleViolations
      })

      if (totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      console.error(`Error:`, error)
      process.exit(1)
    }
  }
}
