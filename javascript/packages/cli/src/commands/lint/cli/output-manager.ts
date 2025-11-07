import { SummaryReporter } from "./summary-reporter.js"
import { SimpleFormatter, DetailedFormatter, GitHubActionsFormatter, type JSONOutput } from "./formatters/index.js"

import type { ThemeInput } from "@herb-tools/highlighter"
import type { FormatOption } from "./argument-parser.js"
import type { ProcessingResult } from "./file-processor.js"

interface OutputOptions {
  formatOption: FormatOption
  theme: ThemeInput
  wrapLines: boolean
  truncateLines: boolean
  showTiming: boolean
  useGitHubActions: boolean
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
    const { allOffenses, files, totalErrors, totalWarnings, totalInfo, totalHints, totalIgnored, totalWouldBeIgnored, filesWithOffenses, ruleCount, ruleOffenses, context } = results

    const autofixableCount = allOffenses.filter(offense => offense.autocorrectable).length

    if (options.useGitHubActions) {
      const githubFormatter = new GitHubActionsFormatter(options.wrapLines, options.truncateLines)
      await githubFormatter.formatAnnotations(allOffenses)

      if (options.formatOption !== "json") {
        const regularFormatter = options.formatOption === "simple"
          ? new SimpleFormatter()
          : new DetailedFormatter(options.theme, options.wrapLines, options.truncateLines)

        await regularFormatter.format(allOffenses, files.length === 1)

        this.summaryReporter.displayMostViolatedRules(ruleOffenses)
        this.summaryReporter.displaySummary({
          files,
          totalErrors,
          totalWarnings,
          totalInfo,
          totalHints,
          totalIgnored,
          totalWouldBeIgnored,
          filesWithOffenses,
          ruleCount,
          startTime: options.startTime,
          startDate: options.startDate,
          showTiming: options.showTiming,
          ruleOffenses,
          autofixableCount,
          ignoreDisableComments: context?.ignoreDisableComments,
        })
      }
    } else if (options.formatOption === "json") {
      const output: JSONOutput = {
        offenses: allOffenses.map(({ filename, offense }) => ({
          filename,
          message: offense.message,
          location: offense.location.toJSON(),
          severity: offense.severity,
          code: offense.code,
          source: offense.source
        })),
        summary: {
          filesChecked: files.length,
          filesWithOffenses,
          totalErrors,
          totalWarnings,
          totalInfo,
          totalHints,
          totalIgnored,
          totalOffenses: totalErrors + totalWarnings,
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

      await formatter.format(allOffenses, files.length === 1)

      this.summaryReporter.displayMostViolatedRules(ruleOffenses)
      this.summaryReporter.displaySummary({
        files,
        totalErrors,
        totalWarnings,
        totalInfo,
        totalHints,
        totalIgnored,
        totalWouldBeIgnored,
        filesWithOffenses,
        ruleCount,
        startTime: options.startTime,
        startDate: options.startDate,
        showTiming: options.showTiming,
        ruleOffenses,
        autofixableCount,
        ignoreDisableComments: context?.ignoreDisableComments,
      })
    }
  }

  /**
   * Output informational message (like "no files found")
   */
  outputInfo(message: string, options: OutputOptions): void {
    if (options.useGitHubActions) {
      // GitHub Actions format doesn't output anything for info messages
    } else if (options.formatOption === "json") {
      const output: JSONOutput = {
        offenses: [],
        summary: {
          filesChecked: 0,
          filesWithOffenses: 0,
          totalErrors: 0,
          totalWarnings: 0,
          totalInfo: 0,
          totalHints: 0,
          totalIgnored: 0,
          totalOffenses: 0,
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
    if (options.useGitHubActions) {
      console.log(`::error::${message}`)
    } else if (options.formatOption === "json") {
      const output: JSONOutput = {
        offenses: [],
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
