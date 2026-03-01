import { colorize, hyperlink, severityColor, ANSI_REGEX, ANSI_REGEX_START, ANSI_ESCAPE } from "./color.js"
import { applyDimToStyledText } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import { GUTTER_WIDTH, MIN_CONTENT_WIDTH } from "./gutter-config.js"

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
    const plainLine = line.replace(ANSI_REGEX, "")

    if (plainLine.length <= maxWidth) {
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

    if (diagnosticStart > plainLine.length - maxWidth / 3) {
      const availableWidth = maxWidth - ellipsisLength
      const startPos = Math.max(0, plainLine.length - availableWidth)

      const visiblePortion = this.extractPortionFromPosition(line, startPos, plainLine.length)
      const truncated = ellipsis + visiblePortion

      return {
        line: truncated,
        adjustedStart: Math.max(0, diagnosticStart - startPos + ellipsisCharLength),
        adjustedEnd: Math.max(0, diagnosticEnd - startPos + ellipsisCharLength)
      }
    }

    const contextWidth = maxWidth - (ellipsisLength * 2)
    const contextStart = Math.max(0, diagnosticStart - contextWidth / 3)
    const contextEnd = Math.min(plainLine.length, contextStart + contextWidth)

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
      showLineNumbers: _showLineNumbers = true, // eslint-disable-line no-unused-vars
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
    const targetLineNumber = diagnostic.location.start.line
    const column = diagnostic.location.start.column - 1

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
    let adjustedColumn = column
    let adjustedPointerLength = Math.max(1, diagnostic.location.end.column - diagnostic.location.start.column)

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1 - lineOffset] || ""
      const isTargetLine = i === targetLineNumber

      const lineNumber = isTargetLine
        ? colorize(i.toString().padStart(3, " "), "bold")
        : colorize(i.toString().padStart(3, " "), "gray")

      const prefix = isTargetLine
        ? colorize("  → ", color)
        : "    "

      const separator = colorize("│", "gray")

      let displayLine = line

      if (isTargetLine) {
        displayLine = line
      } else {
        displayLine = applyDimToStyledText(line)
      }

      if (shouldWrap) {
        const linePrefix = `${prefix}${lineNumber} ${separator} `
        const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
        const wrappedLines = LineWrapper.wrapLine(displayLine, availableWidth, "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            contextOutput += `${linePrefix}${wrappedLines[j]}\n`
          } else {
            contextOutput += `        ${separator} ${wrappedLines[j]}\n`
          }
        }
      } else if (shouldTruncate) {
        const linePrefix = `${prefix}${lineNumber} ${separator} `
        const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)

        let truncatedLine: string

        if (isTargetLine) {
          const diagnosticEnd = diagnostic.location.end.column - 1
          const result = this.truncateLineForDiagnostic(displayLine, column, diagnosticEnd, availableWidth)
          truncatedLine = result.line
          adjustedColumn = result.adjustedStart
          adjustedPointerLength = Math.max(1, result.adjustedEnd - result.adjustedStart)
        } else {
          truncatedLine = LineWrapper.truncateLine(displayLine, availableWidth)
        }

        contextOutput += `${linePrefix}${truncatedLine}\n`
      } else {
        contextOutput += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      }

      if (isTargetLine) {
        const pointerPrefix = `        ${colorize("│", "gray")}`
        const pointerSpacing = " ".repeat(adjustedColumn + 2)
        const adjustedPointer = colorize(
          "~".repeat(adjustedPointerLength),
          color,
        )
        contextOutput += `${pointerPrefix}${pointerSpacing}${adjustedPointer}\n`
      }
    }

    const highlightedMessage = this.highlightBackticks(diagnostic.message)
    const { suffix } = options
    const suffixText = suffix ? ` ${suffix}` : ""

    return `[${text}] ${highlightedMessage} (${diagnosticId})${suffixText}

${fileHeader}

${contextOutput.trimEnd()}
`
  }
}
