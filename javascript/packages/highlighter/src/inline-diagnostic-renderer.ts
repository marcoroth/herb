import { colorize, hyperlink, severityColor } from "./color.js"
import { TextFormatter } from "./text-formatter.js"
import { LineWrapper } from "./line-wrapper.js"
import * as gutter from "./gutter.js"
import { DIAGNOSTIC_SEVERITIES } from "@herb-tools/core"
import { computeDiagnosticMarkers } from "./diagnostic-markers.js"

import type { Diagnostic, DiagnosticSeverity } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { DiagnosticMarker } from "./diagnostic-markers.js"

interface LineMarker {
  diagnostic: Diagnostic
  marker: DiagnosticMarker
  isLastLine: boolean
}

export class InlineDiagnosticRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  private getSeverityText(severity: DiagnosticSeverity): string {
    return colorize(colorize(severity, severityColor(severity)), "bold")
  }

  private getHighestSeverity(diagnostics: Diagnostic[]): DiagnosticSeverity {
    for (const severity of DIAGNOSTIC_SEVERITIES) {
      if (diagnostics.some(diagnostic => diagnostic.severity === severity)) {
        return severity
      }
    }

    return "warning"
  }

  render(
    path: string,
    content: string,
    diagnostics: Diagnostic[],
    showLineNumbers = true,
    wrapLines = false,
    maxWidth = LineWrapper.getTerminalWidth(),
    truncateLines = false,
    codeUrlBuilder?: (code: string) => string,
  ): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)
    const contentLines = content.split("\n")

    const markersByLine = new Map<number, LineMarker[]>()
    for (const diagnostic of diagnostics) {
      const markers = computeDiagnosticMarkers(diagnostic.location, contentLines)

      markers.forEach((marker, index) => {
        if (!markersByLine.has(marker.line)) {
          markersByLine.set(marker.line, [])
        }

        markersByLine.get(marker.line)!.push({
          diagnostic,
          marker,
          isLastLine: index === markers.length - 1,
        })
      })
    }

    const severityOrder: Record<DiagnosticSeverity, number> = {
      "error": 0,
      "warning": 1,
      "info": 2,
      "hint": 3
    }

    for (const lineMarkers of markersByLine.values()) {
      lineMarkers.sort((a, b) => {
        const orderA = severityOrder[a.diagnostic.severity] ?? 99
        const orderB = severityOrder[b.diagnostic.severity] ?? 99
        return orderA - orderB
      })
    }

    const lines = highlightedContent.split("\n")
    let output = showLineNumbers ? `${colorize(path, "cyan")}\n\n` : ""
    let previousLineHadMessages = false

    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1] || ""
      const lineMarkers = markersByLine.get(i) || []
      const lineDiagnostics = lineMarkers.map(({ diagnostic }) => diagnostic)
      const hasDiagnostics = lineMarkers.length > 0
      const hasMessages = lineMarkers.some(({ isLastLine }) => isLastLine)

      if (previousLineHadMessages) {
        output += showLineNumbers ? `${gutter.pointerPrefix()}\n` : "\n"
      }

      const highestSeverity = this.getHighestSeverity(lineDiagnostics)
      const lineColor = severityColor(highestSeverity)

      const displayLine = line
      let contentWidth = maxWidth

      if (wrapLines && showLineNumbers) {
        const prefix = gutter.linePrefix(i, hasDiagnostics, hasDiagnostics ? lineColor : undefined)
        contentWidth = gutter.availableWidth(maxWidth)

        const wrappedLines = LineWrapper.wrapLine(displayLine, contentWidth, "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            output += `${prefix}${wrappedLines[j]}\n`
          } else {
            output += `${gutter.continuationPrefix()}${wrappedLines[j]}\n`
          }
        }
      } else if (truncateLines && showLineNumbers) {
        const prefix = gutter.linePrefix(i, hasDiagnostics, hasDiagnostics ? lineColor : undefined)
        contentWidth = gutter.availableWidth(maxWidth)

        const truncatedLine = LineWrapper.truncateLine(displayLine, contentWidth)
        output += `${prefix}${truncatedLine}\n`
      } else if (showLineNumbers) {
        output += `${gutter.linePrefix(i, hasDiagnostics, hasDiagnostics ? lineColor : undefined)}${displayLine}\n`
      } else if (wrapLines) {
        contentWidth = maxWidth
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
        for (const { diagnostic, marker, isLastLine } of lineMarkers) {
          const pointerLength = Math.max(1, marker.end - marker.start)
          const pointer = colorize(
            "~".repeat(pointerLength),
            severityColor(diagnostic.severity),
          )

          const severityText = this.getSeverityText(diagnostic.severity)
          const diagnosticIdText = diagnostic.code || "-"
          const diagnosticId = codeUrlBuilder && diagnostic.code ? hyperlink(diagnosticIdText, codeUrlBuilder(diagnostic.code)) : diagnosticIdText
          const highlightedMessage = TextFormatter.highlightBackticks(diagnostic.message)
          const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`
          const dimmedDiagnosticText =
            TextFormatter.dimAnsiCodes(diagnosticText)

          if (showLineNumbers) {
            const pointerPrefix = gutter.pointerPrefix()
            const pointerSpacing = " ".repeat(Math.max(0, marker.start + 1))

            output += `${pointerPrefix}${pointerSpacing}${pointer}\n`

            if (isLastLine) {
              output += `${pointerPrefix}${pointerSpacing}${dimmedDiagnosticText}\n`
            }
          } else {
            const pointerSpacing = " ".repeat(Math.max(0, marker.start))

            output += `${pointerSpacing}${pointer}\n`

            if (isLastLine) {
              output += `${dimmedDiagnosticText}\n`
            }
          }
        }
      }

      previousLineHadMessages = hasMessages
    }

    return output.trimEnd()
  }
}
