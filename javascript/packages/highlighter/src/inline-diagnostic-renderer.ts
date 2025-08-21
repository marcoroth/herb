import { colorize } from "./color.js"
import { TextFormatter } from "./text-formatter.js"
import { LineWrapper } from "./line-wrapper.js"
import { GUTTER_WIDTH, MIN_CONTENT_WIDTH } from "./gutter-config.js"
import type { Diagnostic } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"

export class InlineDiagnosticRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  render(
    path: string,
    content: string,
    diagnostics: Diagnostic[],
    _contextLines: number,
    showLineNumbers = true,
    wrapLines = false,
    maxWidth = LineWrapper.getTerminalWidth(),
    truncateLines = false,
  ): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)

    const diagnosticsByLine = new Map<number, Diagnostic[]>()
    for (const diagnostic of diagnostics) {
      const lineNumber = diagnostic.location.start.line

      if (!diagnosticsByLine.has(lineNumber)) {
        diagnosticsByLine.set(lineNumber, [])
      }

      diagnosticsByLine.get(lineNumber)!.push(diagnostic)
    }

    for (const lineDiagnostics of diagnosticsByLine.values()) {
      lineDiagnostics.sort((a, b) => {
        if (a.severity === "error" && b.severity === "warning") return -1
        if (a.severity === "warning" && b.severity === "error") return 1

        return 0
      })
    }

    const lines = highlightedContent.split("\n")
    let output = showLineNumbers ? `${colorize(path, "cyan")}\n\n` : ""
    let previousLineHadDiagnostics = false

    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1] || ""
      const lineDiagnostics = diagnosticsByLine.get(i) || []
      const hasDiagnostics = lineDiagnostics.length > 0

      if (hasDiagnostics && previousLineHadDiagnostics) {
        output += "\n"
      }

      const hasErrors = lineDiagnostics.some((diagnostic) => diagnostic.severity === "error")

      let displayLine = line
      let availableWidth = maxWidth

      if (wrapLines && showLineNumbers) {
        const lineNumber = hasDiagnostics
          ? colorize(i.toString().padStart(3, " "), "bold")
          : colorize(i.toString().padStart(3, " "), "gray")

        const prefix = hasDiagnostics
          ? colorize("  → ", hasErrors ? "brightRed" : "brightYellow")
          : "    "

        const separator = colorize("│", "gray")
        const linePrefix = `${prefix}${lineNumber} ${separator} `
        availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)

        const wrappedLines = LineWrapper.wrapLine(displayLine, availableWidth, "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            output += `${linePrefix}${wrappedLines[j]}\n`
          } else {
            output += `        ${separator} ${wrappedLines[j]}\n`
          }
        }
      } else if (truncateLines && showLineNumbers) {
        const lineNumber = hasDiagnostics
          ? colorize(i.toString().padStart(3, " "), "bold")
          : colorize(i.toString().padStart(3, " "), "gray")

        const prefix = hasDiagnostics
          ? colorize("  → ", hasErrors ? "brightRed" : "brightYellow")
          : "    "

        const separator = colorize("│", "gray")
        const linePrefix = `${prefix}${lineNumber} ${separator} `
        availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)

        const truncatedLine = LineWrapper.truncateLine(displayLine, availableWidth)
        output += `${linePrefix}${truncatedLine}\n`
      } else if (showLineNumbers) {
        const lineNumber = hasDiagnostics
          ? colorize(i.toString().padStart(3, " "), "bold")
          : colorize(i.toString().padStart(3, " "), "gray")

        const prefix = hasDiagnostics
          ? colorize("  → ", hasErrors ? "brightRed" : "brightYellow")
          : "    "

        const separator = colorize("│", "gray")

        output += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      } else if (wrapLines) {
        availableWidth = maxWidth
        const wrappedLines = LineWrapper.wrapLine(displayLine, maxWidth)
        for (const wrappedLine of wrappedLines) {
          output += `${wrappedLine}\n`
        }
      } else if (truncateLines) {
        const truncatedLine = LineWrapper.truncateLine(displayLine, maxWidth)
        output += `${truncatedLine}\n`
      } else {
        output += `${displayLine}\n`
      }

      if (hasDiagnostics) {
        for (const diagnostic of lineDiagnostics) {
          const column = diagnostic.location.start.column - 1
          const pointerLength = Math.max(
            1,
            diagnostic.location.end.column - diagnostic.location.start.column,
          )
          const isError = diagnostic.severity === "error"

          if (showLineNumbers) {
            const pointerPrefix = `        ${colorize("│", "gray")}`
            const pointerSpacing = " ".repeat(column + 2)
            const pointer = colorize(
              "~".repeat(pointerLength),
              isError ? "brightRed" : "brightYellow",
            )

            output += `${pointerPrefix}${pointerSpacing}${pointer}\n`

            const severityText = isError
              ? colorize("error", "brightRed")
              : colorize("warning", "brightYellow")
            const diagnosticId = colorize(diagnostic.code || "-", "gray")
            const highlightedMessage = TextFormatter.highlightBackticks(diagnostic.message)
            const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`
            const dimmedDiagnosticText =
              TextFormatter.applyDimToStyledText(diagnosticText)

            output += `${pointerPrefix}${pointerSpacing}${dimmedDiagnosticText}\n`
          } else {
            const pointerSpacing = " ".repeat(column)
            const pointer = colorize(
              "~".repeat(pointerLength),
              isError ? "brightRed" : "brightYellow",
            )

            output += `${pointerSpacing}${pointer}\n`

            const severityText = isError
              ? colorize("error", "brightRed")
              : colorize("warning", "brightYellow")
            const diagnosticId = colorize(diagnostic.code || "-", "gray")
            const highlightedMessage = TextFormatter.highlightBackticks(diagnostic.message)
            const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`
            const dimmedDiagnosticText =
              TextFormatter.applyDimToStyledText(diagnosticText)

            output += `${dimmedDiagnosticText}\n`
          }
        }
        output += "\n"
      }

      previousLineHadDiagnostics = hasDiagnostics
    }

    return output.trimEnd()
  }
}
