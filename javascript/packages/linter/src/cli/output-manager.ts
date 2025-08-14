import { SummaryReporter } from "./summary-reporter.js"
import { SimpleFormatter, DetailedFormatter, type JSONOutput } from "./formatters/index.js"

import type { ThemeInput } from "@herb-tools/highlighter"
import type { FormatOption } from "./argument-parser.js"
import type { ProcessingResult } from "./file-processor.js"

interface OutputOptions {
  formatOption: FormatOption
  theme: ThemeInput
  wrapLines: boolean
  truncateLines: boolean
  showTiming: boolean
  startTime: number
  startDate: Date
}

interface LintResults extends ProcessingResult {
  files: string[]
}

export class OutputManager {
  private summaryReporter = new SummaryReporter()

  /**
   * Output successful lint results
   */
  async outputResults(results: LintResults, options: OutputOptions): Promise<void> {
    const { allDiagnostics, files, totalErrors, totalWarnings, filesWithIssues, ruleCount, ruleViolations } = results

    if (options.formatOption === "json") {
      const output: JSONOutput = {
        diagnostics: allDiagnostics.map(({ filename, diagnostic }) => ({
          filename,
          message: diagnostic.message,
          location: diagnostic.location.toJSON(),
          severity: diagnostic.severity,
          code: diagnostic.code,
          source: diagnostic.source
        })),
        summary: {
          filesChecked: files.length,
          filesWithViolations: filesWithIssues,
          totalErrors,
          totalWarnings,
          totalViolations: totalErrors + totalWarnings,
          ruleCount
        },
        timing: null,
        completed: true,
        clean: totalErrors === 0 && totalWarnings === 0,
        message: null
      }

      const duration = Date.now() - options.startTime
      output.timing = options.showTiming ? {
        startTime: options.startDate.toISOString(),
        duration: duration
      } : null

      console.log(JSON.stringify(output, null, 2))
    } else {
      const formatter = options.formatOption === "simple"
        ? new SimpleFormatter()
        : new DetailedFormatter(options.theme, options.wrapLines, options.truncateLines)

      await formatter.format(allDiagnostics, files.length === 1)

      this.summaryReporter.displayMostViolatedRules(ruleViolations)
      this.summaryReporter.displaySummary({
        files,
        totalErrors,
        totalWarnings,
        filesWithViolations: filesWithIssues,
        ruleCount,
        startTime: options.startTime,
        startDate: options.startDate,
        showTiming: options.showTiming,
        ruleViolations
      })
    }
  }

  /**
   * Output informational message (like "no files found")
   */
  outputInfo(message: string, options: OutputOptions): void {
    if (options.formatOption === "json") {
      const output: JSONOutput = {
        diagnostics: [],
        summary: {
          filesChecked: 0,
          filesWithViolations: 0,
          totalErrors: 0,
          totalWarnings: 0,
          totalViolations: 0,
          ruleCount: 0
        },
        timing: null,
        completed: false,
        clean: null,
        message
      }

      const duration = Date.now() - options.startTime
      output.timing = options.showTiming ? {
        startTime: options.startDate.toISOString(),
        duration: duration
      } : null

      console.log(JSON.stringify(output, null, 2))
    } else {
      console.log(message)
    }
  }

  /**
   * Output error message
   */
  outputError(message: string, options: OutputOptions): void {
    if (options.formatOption === "json") {
      const output: JSONOutput = {
        diagnostics: [],
        summary: null,
        timing: null,
        completed: false,
        clean: null,
        message
      }

      console.log(JSON.stringify(output, null, 2))
    } else {
      console.error(message)
    }
  }
}
