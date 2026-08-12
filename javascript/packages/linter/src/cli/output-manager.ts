import { meetsSeverityThreshold } from "@herb-tools/core"

import { SummaryReporter } from "./summary-reporter.js"
import { SimpleFormatter, DetailedFormatter, GitHubActionsFormatter, type JSONOutput } from "./formatters/index.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { ThemeInput } from "@herb-tools/highlighter"
import type { FormatOption } from "./argument-parser.js"
import type { ProcessedFile, ProcessingResult } from "./file-processor.js"
import type { SummaryData, RuleFilterFlag } from "./summary-reporter.js"

interface OutputOptions {
  formatOption: FormatOption
  theme: ThemeInput
  wrapLines: boolean
  truncateLines: boolean
  showTiming: boolean
  useGitHubActions: boolean
  startTime: number
  startDate: Date
  toolVersion?: string
  failLevel?: DiagnosticSeverity
  logLevel?: DiagnosticSeverity
  logLevelLoweredFrom?: DiagnosticSeverity
  logLevelLoweredBy?: RuleFilterFlag
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
    const { allOffenses, files, totalErrors, totalWarnings, totalIgnored, filesWithOffenses, ruleCount, ruleOffenses, context } = results

    const logLevel = options.logLevel ?? "hint"

    const reportedOffenses = this.reportedOffenses(allOffenses, logLevel)

    if (options.useGitHubActions) {
      const githubFormatter = new GitHubActionsFormatter(options.wrapLines, options.truncateLines, context?.projectPath)
      await githubFormatter.formatAnnotations(reportedOffenses)

      if (options.formatOption !== "json") {
        const regularFormatter = options.formatOption === "simple"
          ? new SimpleFormatter()
          : new DetailedFormatter(options.theme, options.wrapLines, options.truncateLines, context?.projectPath, context?.showFixDiff)

        await regularFormatter.format(reportedOffenses, files.length === 1)

        this.summaryReporter.displayMostViolatedRules(ruleOffenses)
        this.summaryReporter.displaySummary(this.summaryData(results, options))
      }
    } else if (options.formatOption === "json") {
      const output: JSONOutput = {
        offenses: reportedOffenses.map(({ filename, offense }) => ({
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
          totalInfo: results.totalInfo,
          totalHints: results.totalHints,
          totalIgnored,
          totalOffenses: totalErrors + totalWarnings,
          totalNotReported: allOffenses.length - reportedOffenses.length,
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
        : new DetailedFormatter(options.theme, options.wrapLines, options.truncateLines, context?.projectPath, context?.showFixDiff)

      await formatter.format(reportedOffenses, files.length === 1)

      this.summaryReporter.displayMostViolatedRules(ruleOffenses)
      this.summaryReporter.displaySummary(this.summaryData(results, options))
    }
  }

  private reportedOffenses(allOffenses: ProcessedFile[], logLevel: DiagnosticSeverity): ProcessedFile[] {
    if (logLevel === "hint") return allOffenses

    return allOffenses.filter(({ offense }) => meetsSeverityThreshold(offense.severity, logLevel))
  }

  private summaryData(results: LintResults, options: OutputOptions): SummaryData {
    const { allOffenses, files, totalErrors, totalWarnings, totalInfo, totalHints, totalIgnored, totalWouldBeIgnored, filesWithOffenses, ruleCount, ruleOffenses, rulesSkippedByVersion, context } = results

    const failLevel = options.failLevel ?? "error"
    const logLevel = options.logLevel ?? "hint"

    const failingFiles = new Set<string>()
    const notFailingFiles = new Set<string>()

    for (const { filename, offense } of allOffenses) {
      if (meetsSeverityThreshold(offense.severity, failLevel)) {
        failingFiles.add(filename)
      } else {
        notFailingFiles.add(filename)
      }
    }

    return {
      files,
      totalErrors,
      totalWarnings,
      totalInfo,
      totalHints,
      totalIgnored,
      totalWouldBeIgnored,
      filesWithOffenses,
      filesFailing: failingFiles.size,
      filesNotFailing: notFailingFiles.size,
      failLevel,
      logLevel,
      logLevelLoweredFrom: options.logLevelLoweredFrom,
      logLevelLoweredBy: options.logLevelLoweredBy,
      ruleCount,
      startTime: options.startTime,
      startDate: options.startDate,
      showTiming: options.showTiming,
      ruleOffenses,
      autofixableCount: allOffenses.filter(offense => offense.autocorrectable).length,
      unsafeAutofixableCount: allOffenses.filter(offense => offense.unsafeAutocorrectable).length,
      ignoreDisableComments: context?.ignoreDisableComments,
      rulesSkippedByVersion,
      rulesDisabledByConfig: results.rulesDisabledByConfig,
      rulesNotEnabledByDefault: results.rulesNotEnabledByDefault,
      configVersion: context?.config?.configVersion,
      configPath: context?.config?.path,
      hasConfigFile: context?.hasConfigFile,
      toolVersion: options.toolVersion,
      only: context?.only,
      allRules: context?.allRules,
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
          totalNotReported: 0,
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
