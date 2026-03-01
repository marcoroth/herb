import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic, SerializedDiagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

interface JSONOffense extends SerializedDiagnostic {
  filename: string
}

interface JSONSummary {
  filesChecked: number
  filesWithOffenses: number
  totalErrors: number
  totalWarnings: number
  totalInfo: number
  totalHints: number
  totalIgnored: number
  totalOffenses: number
  ruleCount: number
}

interface JSONTiming {
  startTime: string
  duration: number
}

export interface JSONOutput {
  offenses: JSONOffense[]
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
  totalInfo: number
  totalHints: number
  totalIgnored: number
  filesWithOffenses: number
  ruleCount: number
  startTime: number
  startDate: Date
  showTiming: boolean
}

export class JSONFormatter extends BaseFormatter {
  async format(allOffenses: ProcessedFile[]): Promise<void> {
    const jsonOffenses: JSONOffense[] = allOffenses.map(({ filename, offense }) => ({
      filename,
      message: offense.message,
      location: offense.location.toJSON(),
      severity: offense.severity,
      code: offense.code,
      source: offense.source
    }))

    const output: JSONOutput = {
      offenses: jsonOffenses,
      summary: null,
      timing: null,
      completed: true,
      clean: jsonOffenses.length === 0,
      message: null
    }

    console.log(JSON.stringify(output, null, 2))
  }

  async formatWithSummary(allOffenses: ProcessedFile[], options: JSONFormatOptions): Promise<void> {
    const jsonOffenses: JSONOffense[] = allOffenses.map(({ filename, offense }) => ({
      filename,
      message: offense.message,
      location: offense.location.toJSON(),
      severity: offense.severity,
      code: offense.code,
      source: offense.source
    }))

    const summary: JSONSummary = {
      filesChecked: options.files.length,
      filesWithOffenses: options.filesWithOffenses,
      totalErrors: options.totalErrors,
      totalWarnings: options.totalWarnings,
      totalInfo: options.totalInfo,
      totalHints: options.totalHints,
      totalIgnored: options.totalIgnored,
      totalOffenses: options.totalErrors + options.totalWarnings,
      ruleCount: options.ruleCount
    }

    const output: JSONOutput = {
      offenses: jsonOffenses,
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

  formatFile(_filename: string, _offenses: Diagnostic[]): void {
    // Not used in JSON formatter, everything is handled in format()
  }
}
