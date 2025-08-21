import { BaseFormatter } from "./base-formatter.js"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
export class GitHubActionsFormatter extends BaseFormatter {
  private static readonly MESSAGE_ESCAPE_MAP: Record<string, string> = {
    '%': '%25',
    '\n': '%0A',
    '\r': '%0D'
  }

  private static readonly PARAM_ESCAPE_MAP: Record<string, string> = {
    '%': '%25',
    '\n': '%0A',
    '\r': '%0D',
    ':': '%3A',
    ',': '%2C'
  }

  async format(allDiagnostics: ProcessedFile[]): Promise<void> {
    for (const { filename, offense } of allDiagnostics) {
      this.formatDiagnostic(filename, offense)
    }

    if (allDiagnostics.length > 0) {
      console.log()
    }
  }

  formatFile(filename: string, diagnostics: Diagnostic[]): void {
    for (const diagnostic of diagnostics) {
      this.formatDiagnostic(filename, diagnostic)
    }
  }

  // GitHub Actions annotation format:
  // ::{level} file={file},line={line},col={col}::{message}
  //
  private formatDiagnostic(filename: string, diagnostic: Diagnostic): void {
    const level = diagnostic.severity === "error" ? "error" : "warning"
    const { line, column } = diagnostic.location.start

    const escapedFilename = this.escapeParam(filename)
    const message = this.escapeMessage(diagnostic.message)

    let fullMessage = message

    if (diagnostic.code) {
      fullMessage += ` [${diagnostic.code}]`
    }

    console.log(`\n::${level} file=${escapedFilename},line=${line},col=${column}::${fullMessage}`)
  }

  private escapeMessage(string: string): string {
    return string.replace(
      new RegExp(Object.keys(GitHubActionsFormatter.MESSAGE_ESCAPE_MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'),
      match => GitHubActionsFormatter.MESSAGE_ESCAPE_MAP[match]
    )
  }

  private escapeParam(string: string): string {
    return string.replace(
      new RegExp(Object.keys(GitHubActionsFormatter.PARAM_ESCAPE_MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'),
      match => GitHubActionsFormatter.PARAM_ESCAPE_MAP[match]
    )
  }
}
