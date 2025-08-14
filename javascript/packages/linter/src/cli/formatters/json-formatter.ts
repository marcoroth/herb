import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic, SerializedDiagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

interface JSONDiagnostic extends SerializedDiagnostic {
  filename: string
}

interface JSONSummary {
  filesChecked: number
  filesWithViolations: number
  totalErrors: number
  totalWarnings: number
  totalViolations: number
  ruleCount: number
}

interface JSONTiming {
  startTime: string
  duration: number
}

export interface JSONOutput {
  diagnostics: JSONDiagnostic[]
  summary: JSONSummary | null
  timing: JSONTiming | null
  completed: boolean
  clean: boolean | null
  message: string | null
}

interface JSONFormatOptions {
  files: string[]
  totalErrors: number
  totalWarnings: number
  filesWithIssues: number
  ruleCount: number
  startTime: number
  startDate: Date
  showTiming: boolean
}

export class JSONFormatter extends BaseFormatter {
  async format(allDiagnostics: ProcessedFile[]): Promise<void> {
    const jsonDiagnostics: JSONDiagnostic[] = allDiagnostics.map(({ filename, diagnostic }) => ({
      filename,
      message: diagnostic.message,
      location: diagnostic.location.toJSON(),
      severity: diagnostic.severity,
      code: diagnostic.code,
      source: diagnostic.source
    }))

    const output: JSONOutput = {
      diagnostics: jsonDiagnostics,
      summary: null,
      timing: null,
      completed: true,
      clean: jsonDiagnostics.length === 0,
      message: null
    }

    console.log(JSON.stringify(output, null, 2))
  }

  async formatWithSummary(allDiagnostics: ProcessedFile[], options: JSONFormatOptions): Promise<void> {
    const jsonDiagnostics: JSONDiagnostic[] = allDiagnostics.map(({ filename, diagnostic }) => ({
      filename,
      message: diagnostic.message,
      location: diagnostic.location.toJSON(),
      severity: diagnostic.severity,
      code: diagnostic.code,
      source: diagnostic.source
    }))

    const summary: JSONSummary = {
      filesChecked: options.files.length,
      filesWithViolations: options.filesWithIssues,
      totalErrors: options.totalErrors,
      totalWarnings: options.totalWarnings,
      totalViolations: options.totalErrors + options.totalWarnings,
      ruleCount: options.ruleCount
    }

    const output: JSONOutput = {
      diagnostics: jsonDiagnostics,
      summary,
      timing: null,
      completed: true,
      clean: options.totalErrors === 0 && options.totalWarnings === 0,
      message: null
    }

    const duration = Date.now() - options.startTime
    output.timing = options.showTiming ? {
      startTime: options.startDate.toISOString(),
      duration: duration
    } : null

    console.log(JSON.stringify(output, null, 2))
  }

  formatFile(_filename: string, _diagnostics: Diagnostic[]): void {
    // Not used in JSON formatter, everything is handled in format()
  }
}
