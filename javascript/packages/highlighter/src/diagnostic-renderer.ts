import { colorize, hyperlink, severityColor } from "./color.js"
import { visibleWidth, ANSI_REGEX_START, ANSI_ESCAPE } from "./ansi.js"
import { dimStyledText } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import * as gutter from "./gutter.js"
import { computeDiagnosticMarkers } from "./diagnostic-markers.js"

import type { DiagnosticMarker } from "./diagnostic-markers.js"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { Diagnostic } from "@herb-tools/core"

export interface DiagnosticRenderOptions {
  contextLines?: number
  showLineNumbers?: boolean
  optimizeHighlighting?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  codeUrl?: string
  fileUrl?: string
  suffix?: string
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

  private truncateLineForDiagnostic(
    line: string,
    diagnosticStart: number,
    diagnosticEnd: number,
    maxWidth: number
  ): { line: string; adjustedStart: number; adjustedEnd: number } {
    const plainLineLength = visibleWidth(line)

    if (plainLineLength <= maxWidth) {
      return { line, adjustedStart: diagnosticStart, adjustedEnd: diagnosticEnd }
    }

    const ellipsisChar = "…"
    const ellipsis = colorize(ellipsisChar, "dim")
    const rightPadding = 2
    const ellipsisCharLength = ellipsisChar.length
    const ellipsisLength = ellipsisCharLength + rightPadding

    if (diagnosticStart < maxWidth / 3) {
      const availableWidth = maxWidth - ellipsisLength
      const truncated = LineWrapper.truncateLine(line, availableWidth)
      return {
        line: truncated,
        adjustedStart: diagnosticStart,
        adjustedEnd: Math.min(diagnosticEnd, availableWidth)
      }
    }

    if (diagnosticStart > plainLineLength - maxWidth / 3) {
      const availableWidth = maxWidth - ellipsisLength
      const startPos = Math.max(0, plainLineLength - availableWidth)

      const visiblePortion = this.extractPortionFromPosition(line, startPos, plainLineLength)
      const truncated = ellipsis + visiblePortion

      return {
        line: truncated,
        adjustedStart: Math.max(0, diagnosticStart - startPos + ellipsisCharLength),
        adjustedEnd: Math.max(0, diagnosticEnd - startPos + ellipsisCharLength)
      }
    }

    const contextWidth = maxWidth - (ellipsisLength * 2)
    const contextStart = Math.max(0, diagnosticStart - contextWidth / 3)
    const contextEnd = Math.min(plainLineLength, contextStart + contextWidth)

    const visiblePortion = this.extractPortionFromPosition(line, contextStart, contextEnd)
    const truncated = ellipsis + visiblePortion + ellipsis

    return {
      line: truncated,
      adjustedStart: diagnosticStart - contextStart + ellipsisCharLength,
      adjustedEnd: diagnosticEnd - contextStart + ellipsisCharLength
    }
  }

  private extractPortionFromPosition(styledLine: string, startPos: number, endPos: number): string {
    let styledIndex = 0
    let plainIndex = 0
    let result = ""
    let inRange = false

    while (styledIndex < styledLine.length && plainIndex <= endPos) {
      const char = styledLine[styledIndex]

      if (char === ANSI_ESCAPE) {
        const ansiMatch = styledLine.slice(styledIndex).match(ANSI_REGEX_START)
        if (ansiMatch) {
          if (inRange || plainIndex >= startPos) {
            result += ansiMatch[0]
          }
          styledIndex += ansiMatch[0].length
          continue
        }
      }

      if (plainIndex >= startPos && !inRange) {
        inRange = true
      }

      if (inRange) {
        result += char
      }

      styledIndex++
      plainIndex++
    }

    return result
  }

  renderSingle(
    path: string,
    diagnostic: Diagnostic,
    content: string,
    options: DiagnosticRenderOptions = {},
  ): string {
    const {
      contextLines = 2,
      showLineNumbers = true,
      optimizeHighlighting = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
    } = options

    const shouldWrap = wrapLines && !truncateLines
    const shouldTruncate = truncateLines
    const fileHeaderText = `${colorize(path, "cyan")}:${colorize(`${diagnostic.location.start.line}:${diagnostic.location.start.column}`, "cyan")}`
    const { codeUrl, fileUrl: fileUrlOption } = options
    const fileHeader = fileUrlOption ? hyperlink(fileHeaderText, fileUrlOption) : fileHeaderText

    const color = severityColor(diagnostic.severity)
    const text = colorize(colorize(diagnostic.severity, color), "bold")
    const diagnosticIdText = diagnostic.code || "-"
    const diagnosticId = codeUrl ? hyperlink(diagnosticIdText, codeUrl) : diagnosticIdText

    const originalLines = content.split("\n")

    const markers = computeDiagnosticMarkers(diagnostic.location, originalLines)
    const markersByLine = new Map<number, DiagnosticMarker>(markers.map(marker => [marker.line, marker]))

    const firstMarkedLine = markers[0].line
    const lastMarkedLine = markers[markers.length - 1].line

    const startLine = Math.max(1, firstMarkedLine - contextLines)
    const endLine = Math.min(originalLines.length, lastMarkedLine + contextLines)

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

    const gutterPrefix = showLineNumbers ? gutter.continuationPrefix() : ""
    const contentWidth = showLineNumbers ? gutter.availableWidth(maxWidth) : maxWidth

    let contextOutput = ""

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1 - lineOffset] || ""
      const marker = markersByLine.get(i)
      const isTargetLine = marker !== undefined

      let markerStart = marker ? marker.start : 0
      let markerLength = marker ? Math.max(1, marker.end - marker.start) : 0

      const prefix = showLineNumbers ? gutter.linePrefix(i, isTargetLine, isTargetLine ? color : undefined, isTargetLine ? fileUrlOption : undefined) : ""

      const displayLine = isTargetLine ? line : dimStyledText(line)

      if (shouldWrap) {
        const wrappedLines = LineWrapper.wrapLine(displayLine, contentWidth, "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            contextOutput += `${prefix}${wrappedLines[j]}\n`
          } else {
            contextOutput += `${gutterPrefix}${wrappedLines[j]}\n`
          }
        }
      } else if (shouldTruncate) {
        let truncatedLine: string

        if (marker) {
          const result = this.truncateLineForDiagnostic(displayLine, marker.start, marker.end, contentWidth)
          truncatedLine = result.line
          markerStart = result.adjustedStart
          markerLength = Math.max(1, result.adjustedEnd - result.adjustedStart)
        } else {
          truncatedLine = LineWrapper.truncateLine(displayLine, contentWidth)
        }

        contextOutput += `${prefix}${truncatedLine}\n`
      } else {
        contextOutput += `${prefix}${displayLine}\n`
      }

      if (marker) {
        const pointer_prefix = showLineNumbers ? gutter.pointerPrefix() : ""
        const pointerSpacing = " ".repeat(Math.max(0, markerStart + (showLineNumbers ? 1 : 0)))
        const pointer = colorize("~".repeat(markerLength), color)

        contextOutput += `${pointer_prefix}${pointerSpacing}${pointer}\n`
      }
    }

    const highlightedMessage = this.highlightBackticks(diagnostic.message)
    const { suffix } = options
    const suffixText = suffix ? ` ${suffix}` : ""
    const header = showLineNumbers ? `${fileHeader}\n\n` : ""

    return `[${text}] ${highlightedMessage} (${diagnosticId})${suffixText}

${header}${contextOutput.trimEnd()}
`
  }
}
