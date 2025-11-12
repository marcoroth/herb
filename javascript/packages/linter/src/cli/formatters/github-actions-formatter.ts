import { Highlighter } from "@herb-tools/highlighter"

import { BaseFormatter } from "./base-formatter.js"
import { name, version } from "../../../package.json"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
export class GitHubActionsFormatter extends BaseFormatter {
  private highlighter: Highlighter
  private wrapLines: boolean
  private truncateLines: boolean

  constructor(wrapLines: boolean = true, truncateLines: boolean = false) {
    super()
    this.wrapLines = wrapLines
    this.truncateLines = truncateLines
    this.highlighter = new Highlighter()
  }

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

  async format(allDiagnostics: ProcessedFile[], _isSingleFile: boolean = false): Promise<void> {
    await this.formatAnnotations(allDiagnostics)
  }

  async formatAnnotations(allDiagnostics: ProcessedFile[]): Promise<void> {
    if (allDiagnostics.length === 0) return

    if (!this.highlighter.initialized) {
      await this.highlighter.initialize()
    }

    for (const { filename, offense, content } of allDiagnostics) {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      let plainCodePreview = ""
      try {
        const formatted = this.highlighter.highlightDiagnostic(filename, offense, content, {
          contextLines: 2,
          wrapLines: this.wrapLines,
          truncateLines: this.truncateLines
        })

        plainCodePreview = formatted.split('\n').slice(1).join('\n')
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }

      this.formatDiagnostic(filename, offense, plainCodePreview)
    }
  }

  formatFile(filename: string, diagnostics: Diagnostic[]): void {
    for (const diagnostic of diagnostics) {
      this.formatDiagnostic(filename, diagnostic)
    }
  }

  // GitHub Actions annotation format:
  // ::{level} file={file},line={line},col={col},title={title}::{message}
  //
  private formatDiagnostic(filename: string, diagnostic: Diagnostic, codePreview: string = ""): void {
    let level: string

    switch (diagnostic.severity) {
      case "error":
        level = "error"
        break
      case "warning":
        level = "warning"
        break
      case "info":
      case "hint":
        level = "notice"
        break
      default:
        level = "warning"
    }

    const { line, column } = diagnostic.location.start

    const escapedFilename = this.escapeParam(filename)
    let message = diagnostic.message

    if (diagnostic.code) {
      message += ` [${diagnostic.code}]`
    }

    if (codePreview) {
      message += "\n\n" + codePreview
    }

    const escapedMessage = this.escapeMessage(message)

    let annotations = `file=${escapedFilename},line=${line},col=${column}`

    if (diagnostic.code) {
      const title = `${diagnostic.code} • ${name}@${version}`
      const escapedTitle = this.escapeParam(title)

      annotations += `,title=${escapedTitle}`
    }

    console.log(`\n::${level} ${annotations}::${escapedMessage}`)
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
