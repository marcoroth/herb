import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import { meetsSeverityThreshold } from "@herb-tools/core"

import { SummaryReporter } from "./summary-reporter.js"
import { SimpleFormatter, DetailedFormatter, GitHubActionsFormatter, type JSONOutput } from "./formatters/index.js"
import { isStructuredFormat } from "./output-format.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { ThemeInput } from "@herb-tools/highlighter"
import type { FormatOption, OutputTarget } from "./output-format.js"
import type { ProcessedFile, ProcessingResult } from "./file-processor.js"
import type { SummaryData, RuleFilterFlag } from "./summary-reporter.js"

interface OutputOptions {
  formatOption: FormatOption
  outputs?: OutputTarget[]
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
    const { allOffenses, files, ruleOffenses, context } = results

    const logLevel = options.logLevel ?? "hint"

    const reportedOffenses = this.reportedOffenses(allOffenses, logLevel)
    const stdoutFormat = this.stdoutFormat(options)

    if (options.useGitHubActions) {
      const githubFormatter = new GitHubActionsFormatter(options.wrapLines, options.truncateLines, context?.projectPath)
      await githubFormatter.formatAnnotations(reportedOffenses)
    }

    if (stdoutFormat && isStructuredFormat(stdoutFormat)) {
      console.log(this.renderJSON(this.resultsJSON(results, reportedOffenses, options)))
    } else if (stdoutFormat) {
      const formatter = stdoutFormat === "simple"
        ? new SimpleFormatter()
        : new DetailedFormatter(options.theme, options.wrapLines, options.truncateLines, context?.projectPath, context?.showFixDiff)

      await formatter.format(reportedOffenses, files.length === 1)

      this.summaryReporter.displayMostViolatedRules(ruleOffenses)
      this.summaryReporter.displaySummary(this.summaryData(results, options))
    }

    this.writeOutputFiles(options, () => this.renderJSON(this.resultsJSON(results, reportedOffenses, options)))
  }

  private renderJSON(output: JSONOutput): string {
    return JSON.stringify(output, null, 2)
  }

  private resultsJSON(results: LintResults, reportedOffenses: ProcessedFile[], options: OutputOptions): JSONOutput {
    const { allOffenses, files, totalErrors, totalWarnings, totalIgnored, filesWithOffenses, ruleCount } = results

    return {
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
      timing: this.timing(options),
      completed: true,
      clean: totalErrors === 0 && totalWarnings === 0,
      message: null
    }
  }

  private timing(options: OutputOptions): JSONOutput["timing"] {
    return options.showTiming ? {
      startTime: options.startDate.toISOString(),
      duration: Date.now() - options.startTime
    } : null
  }

  private reportedOffenses(allOffenses: ProcessedFile[], logLevel: DiagnosticSeverity): ProcessedFile[] {
    if (logLevel === "hint") return allOffenses

    return allOffenses.filter(({ offense }) => meetsSeverityThreshold(offense.severity, logLevel))
  }

  private summaryData(results: LintResults, options: OutputOptions): SummaryData {
    const { allOffenses, files, totalErrors, totalWarnings, totalInfo, totalHints, totalIgnored, totalWouldBeIgnored, totalCounterSuppressed, filesWithOffenses, ruleCount, ruleOffenses, rulesSkippedByVersion, context } = results

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
      totalCounterSuppressed,
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
    const stdoutFormat = this.stdoutFormat(options)

    if (options.useGitHubActions) {
      // GitHub Actions format doesn't output anything for info messages
    } else if (!stdoutFormat) {
      console.error(message)
    } else if (isStructuredFormat(stdoutFormat)) {
      console.log(this.renderJSON(this.infoJSON(message, options)))
    } else {
      console.log(message)
    }

    this.writeOutputFiles(options, () => this.renderJSON(this.infoJSON(message, options)))
  }

  /**
   * Output error message
   */
  outputError(message: string, options: OutputOptions): void {
    const stdoutFormat = this.stdoutFormat(options)

    if (options.useGitHubActions) {
      console.log(`::error::${message}`)
    } else if (stdoutFormat && isStructuredFormat(stdoutFormat)) {
      console.log(this.renderJSON(this.errorJSON(message)))
    } else {
      console.error(message)
    }

    this.writeOutputFiles(options, () => this.renderJSON(this.errorJSON(message)))
  }

  private infoJSON(message: string, options: OutputOptions): JSONOutput {
    return {
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
      timing: this.timing(options),
      completed: false,
      clean: null,
      message
    }
  }

  private errorJSON(message: string): JSONOutput {
    return {
      offenses: [],
      summary: null,
      timing: null,
      completed: false,
      clean: null,
      message
    }
  }

  private stdoutFormat(options: OutputOptions): FormatOption | undefined {
    const outputs = options.outputs ?? [{ format: options.formatOption }]

    return outputs.find(output => output.path === undefined)?.format
  }

  private writeOutputFiles(options: OutputOptions, render: () => string): void {
    for (const { format, path } of options.outputs ?? []) {
      if (path === undefined || !isStructuredFormat(format)) continue

      try {
        const filePath = resolve(path)

        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, `${render()}\n`, "utf-8")
      } catch (error) {
        console.error(`✗ Could not write --output-file ${path}: ${error instanceof Error ? error.message : error}`)
        process.exitCode = 1
      }
    }
  }
}
