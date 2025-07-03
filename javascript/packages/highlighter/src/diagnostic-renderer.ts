import { colorize } from "./color.js"
import { applyDimToStyledText } from "./util.js"

import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { Diagnostic } from "@herb-tools/core"

export interface DiagnosticRenderOptions {
  contextLines?: number
  showLineNumbers?: boolean
  optimizeHighlighting?: boolean
}

export class DiagnosticRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  private highlightBackticks(text: string): string {
    if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      const boldWhite = "\x1b[1m\x1b[37m"
      const reset = "\x1b[0m"
      return text.replace(/`([^`]+)`/g, `${boldWhite}$1${reset}`)
    }
    return text
  }

  renderSingle(
    path: string,
    diagnostic: Diagnostic,
    content: string,
    options: DiagnosticRenderOptions = {}
  ): string {
    const { contextLines = 2, showLineNumbers: _showLineNumbers = true, optimizeHighlighting = true } = options
    const isError = diagnostic.severity === "error"
    const fileHeader = `${colorize(path, "cyan")}:${colorize(`${diagnostic.location.start.line}:${diagnostic.location.start.column}`, "cyan")}`
    const severityText = isError ? colorize("error", "brightRed") : colorize("warning", "brightYellow")
    const diagnosticId = colorize(diagnostic.code || "-", "gray")

    const originalLines = content.split("\n")
    const targetLineNumber = diagnostic.location.start.line
    const column = diagnostic.location.start.column - 1
    const pointer = colorize("~".repeat(Math.max(1, diagnostic.location.end.column - diagnostic.location.start.column)), isError ? "brightRed" : "brightYellow")

    const startLine = Math.max(1, targetLineNumber - contextLines)
    const endLine = Math.min(originalLines.length, targetLineNumber + contextLines)

    let lines: string[]
    let lineOffset = 0

    if (optimizeHighlighting) {
      const relevantLines = []

      for (let i = startLine; i <= endLine; i++) {
        relevantLines.push(originalLines[i - 1] || "")
      }

      const relevantContent = relevantLines.join("\n")
      const highlightedContent = this.syntaxRenderer.highlight(relevantContent)

      lines = highlightedContent.split("\n")
      lineOffset = startLine - 1
    } else {
      const highlightedContent = this.syntaxRenderer.highlight(content)
      lines = highlightedContent.split("\n")
      lineOffset = 0
    }

    let contextOutput = ""

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1 - lineOffset] || ""
      const isTargetLine = i === targetLineNumber

      const lineNumber = isTargetLine ?
        colorize(i.toString().padStart(3, " "), "bold") :
        colorize(i.toString().padStart(3, " "), "gray")

      const prefix = isTargetLine ?
        colorize("  → ", isError ? "brightRed" : "brightYellow") :
        "    "

      const separator = colorize("│", "gray")

      let displayLine = line

      if (isTargetLine) {
        displayLine = line
        contextOutput += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      } else {
        displayLine = applyDimToStyledText(line)
        contextOutput += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      }

      if (isTargetLine) {
        const pointerPrefix = `        ${colorize("│", "gray")}`
        const pointerSpacing = " ".repeat(column + 2)
        contextOutput += `${pointerPrefix}${pointerSpacing}${pointer}\n`
      }
    }

    const highlightedMessage = this.highlightBackticks(diagnostic.message)

    return `[${severityText}] ${highlightedMessage} (${diagnosticId})

${fileHeader}

${contextOutput.trimEnd()}
`
  }
}
