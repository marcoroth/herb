import { colorize, hyperlink, severityColor } from "./color.js"
import { visibleWidth, ANSI_REGEX_START, ANSI_ESCAPE } from "./ansi.js"
import { dimStyledText } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import { TextFormatter } from "./text-formatter.js"
import * as gutter from "./gutter.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type {
  AnnotationMessage,
  CodeBlockNode,
  DiagnosticHeaderNode,
  Document,
  FileHeaderNode,
  ProgressRuleNode,
} from "./document.js"

export interface AnsiSinkOptions {
  showLineNumbers: boolean
  wrapLines: boolean
  truncateLines: boolean
  maxWidth: number
}

export class AnsiSink {
  private syntaxRenderer: SyntaxRenderer
  private options: AnsiSinkOptions

  constructor(syntaxRenderer: SyntaxRenderer, options: AnsiSinkOptions) {
    this.syntaxRenderer = syntaxRenderer
    this.options = options
  }

  render(document: Document): string {
    const groups: string[] = []
    const nodes = document.nodes

    let i = 0

    while (i < nodes.length) {
      const node = nodes[i]

      if (node.type === "DiagnosticHeader") {
        groups.push(this.renderCard(node, nodes[i + 1] as FileHeaderNode, nodes[i + 2] as CodeBlockNode))
        i += 3
      } else if (node.type === "FileHeader") {
        const block = nodes[i + 1] as CodeBlockNode

        groups.push(block.kind === "AnnotatedListing" ? this.renderInline(node, block) : this.renderListing(node, block))
        i += 2
      } else if (node.type === "CodeBlock") {
        groups.push(node.kind === "AnnotatedListing" ? this.renderInline(null, node) : this.renderListing(null, node))
        i += 1
      } else {
        groups.push(this.renderProgressRule(node))
        i += 1
      }
    }

    return groups.join("\n\n")
  }

  private renderCard(header: DiagnosticHeaderNode, fileHeaderNode: FileHeaderNode, block: CodeBlockNode): string {
    const { showLineNumbers, wrapLines, truncateLines, maxWidth } = this.options

    const shouldWrap = wrapLines && !truncateLines
    const shouldTruncate = truncateLines
    const fileHeaderText = `${colorize(fileHeaderNode.path, "cyan")}:${colorize(`${fileHeaderNode.line}:${fileHeaderNode.column}`, "cyan")}`
    const fileHeader = fileHeaderNode.url ? hyperlink(fileHeaderText, fileHeaderNode.url) : fileHeaderText

    const color = severityColor(header.severity)
    const text = colorize(colorize(header.severity, color), "bold")
    const diagnosticIdText = header.code || "-"
    const diagnosticId = header.codeUrl ? hyperlink(diagnosticIdText, header.codeUrl) : diagnosticIdText

    const lines = this.syntaxRenderer.resolveRuns(block.runs).split("\n")

    const gutterPrefix = showLineNumbers ? gutter.continuationPrefix() : ""
    const contentWidth = showLineNumbers ? gutter.availableWidth(maxWidth) : maxWidth

    let contextOutput = ""

    for (const info of block.lines) {
      const i = info.number
      const line = lines[i - block.firstLine] || ""
      const marker = info.annotations[0]
      const isTargetLine = marker !== undefined

      let markerStart = marker ? marker.start : 0
      let markerLength = marker ? Math.max(1, marker.end - marker.start) : 0

      const prefix = showLineNumbers ? gutter.linePrefix(i, isTargetLine, isTargetLine ? color : undefined) : ""

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

    const highlightedMessage = this.highlightBackticks(header.message)
    const suffixText = header.suffix ? ` ${header.suffix}` : ""
    const headerLine = showLineNumbers ? `${fileHeader}\n\n` : ""

    return `[${text}] ${highlightedMessage} (${diagnosticId})${suffixText}

${headerLine}${contextOutput.trimEnd()}
`
  }

  private renderInline(fileHeaderNode: FileHeaderNode | null, block: CodeBlockNode): string {
    const { showLineNumbers, wrapLines, truncateLines, maxWidth } = this.options

    const lines = this.syntaxRenderer.resolveRuns(block.runs).split("\n")

    let output = showLineNumbers ? `${colorize(fileHeaderNode?.path ?? "", "cyan")}\n\n` : ""
    let previousLineHadMessages = false

    for (const info of block.lines) {
      const i = info.number
      const line = lines[i - block.firstLine] || ""
      const lineMarkers = info.annotations
      const hasDiagnostics = lineMarkers.length > 0
      const hasMessages = lineMarkers.some(annotation => annotation.message !== null)

      if (previousLineHadMessages) {
        output += showLineNumbers ? `${gutter.pointerPrefix()}\n` : "\n"
      }

      const highestSeverity = info.emphasis.kind === "Marked" ? info.emphasis.severity : "warning"
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
        for (const annotation of lineMarkers) {
          const pointerLength = Math.max(1, annotation.end - annotation.start)
          const pointer = colorize(
            "~".repeat(pointerLength),
            severityColor(annotation.severity),
          )

          if (showLineNumbers) {
            const pointerPrefix = gutter.pointerPrefix()
            const pointerSpacing = " ".repeat(Math.max(0, annotation.start + 1))

            output += `${pointerPrefix}${pointerSpacing}${pointer}\n`

            if (annotation.message) {
              output += `${pointerPrefix}${pointerSpacing}${this.annotationMessageText(annotation.severity, annotation.message)}\n`
            }
          } else {
            const pointerSpacing = " ".repeat(Math.max(0, annotation.start))

            output += `${pointerSpacing}${pointer}\n`

            if (annotation.message) {
              output += `${this.annotationMessageText(annotation.severity, annotation.message)}\n`
            }
          }
        }
      }

      previousLineHadMessages = hasMessages
    }

    return output.trimEnd()
  }

  private renderListing(fileHeaderNode: FileHeaderNode | null, block: CodeBlockNode): string {
    if (fileHeaderNode) {
      const hasFocus = block.lines.some(info => info.emphasis.kind === "Focus" || info.emphasis.kind === "Dimmed")

      if (hasFocus || !this.options.showLineNumbers) {
        return this.renderFocusListing(fileHeaderNode, block)
      }

      return this.renderNumberedListing(fileHeaderNode, block)
    }

    return this.renderPlainListing(block)
  }

  private renderNumberedListing(fileHeaderNode: FileHeaderNode, block: CodeBlockNode): string {
    const { wrapLines, truncateLines, maxWidth } = this.options

    const lines = this.syntaxRenderer.resolveRuns(block.runs).split("\n")

    let output = `${colorize(fileHeaderNode.path, "cyan")}\n\n`

    for (const info of block.lines) {
      const i = info.number
      const line = lines[i - block.firstLine] || ""
      const prefix = gutter.linePrefix(i, false)

      if (wrapLines) {
        const wrappedLines = LineWrapper.wrapLine(line, gutter.availableWidth(maxWidth), "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            output += `${prefix}${wrappedLines[j]}\n`
          } else {
            output += `${gutter.continuationPrefix()}${wrappedLines[j]}\n`
          }
        }
      } else if (truncateLines) {
        output += `${prefix}${LineWrapper.truncateLine(line, gutter.availableWidth(maxWidth))}\n`
      } else {
        output += `${prefix}${line}\n`
      }
    }

    return output.trimEnd()
  }

  private renderFocusListing(fileHeaderNode: FileHeaderNode, block: CodeBlockNode): string {
    const { showLineNumbers, wrapLines, truncateLines, maxWidth } = this.options

    const lines = this.syntaxRenderer.resolveRuns(block.runs).split("\n")

    let output = showLineNumbers ? `${colorize(fileHeaderNode.path, "cyan")}\n\n` : ""

    for (const info of block.lines) {
      const i = info.number
      const line = lines[i - block.firstLine] || ""
      const isFocusLine = info.emphasis.kind === "Focus"

      if (showLineNumbers) {
        const prefix = gutter.linePrefix(i, isFocusLine, isFocusLine ? "cyan" : undefined)

        let displayLine = line

        if (!isFocusLine) {
          displayLine = dimStyledText(line)
        }

        if (wrapLines) {
          const wrappedLines = LineWrapper.wrapLine(displayLine, gutter.availableWidth(maxWidth), "")

          for (let j = 0; j < wrappedLines.length; j++) {
            if (j === 0) {
              output += `${prefix}${wrappedLines[j]}\n`
            } else {
              output += `${gutter.continuationPrefix()}${wrappedLines[j]}\n`
            }
          }
        } else if (truncateLines) {
          output += `${prefix}${LineWrapper.truncateLine(displayLine, gutter.availableWidth(maxWidth))}\n`
        } else {
          output += `${prefix}${displayLine}\n`
        }
      } else {
        let displayLine = line

        if (!isFocusLine) {
          displayLine = dimStyledText(line)
        }

        if (wrapLines) {
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
      }
    }

    return output.trimEnd()
  }

  private renderPlainListing(block: CodeBlockNode): string {
    const { wrapLines, truncateLines, maxWidth } = this.options

    const highlighted = this.syntaxRenderer.resolveRuns(block.runs)

    if (wrapLines) {
      const lines = highlighted.split("\n")
      const wrappedLines: string[] = []

      for (const line of lines) {
        const wrapped = LineWrapper.wrapLine(line, maxWidth)
        wrappedLines.push(...wrapped)
      }

      return wrappedLines.join("\n")
    } else if (truncateLines) {
      const lines = highlighted.split("\n")
      const truncatedLines: string[] = []

      for (const line of lines) {
        const truncated = LineWrapper.truncateLine(line, maxWidth)
        truncatedLines.push(truncated)
      }

      return truncatedLines.join("\n")
    }

    return highlighted
  }

  private renderProgressRule(node: ProgressRuleNode): string {
    const width = LineWrapper.getTerminalWidth()
    const progressText = `[${node.index}/${node.total}]`
    const rightPadding = 16
    const separatorLength = Math.max(0, width - progressText.length - 1 - rightPadding)
    const separator = '⎯'
    const leftSeparator = separator.repeat(separatorLength)
    const rightSeparator = separator.repeat(4)
    const progress = progressText

    return `${leftSeparator}  ${progress} ${rightSeparator}`
  }

  private annotationMessageText(severity: DiagnosticSeverity, message: AnnotationMessage): string {
    const severityText = this.getSeverityText(severity)
    const diagnosticIdText = message.code || "-"
    const diagnosticId = message.codeUrl ? hyperlink(diagnosticIdText, message.codeUrl) : diagnosticIdText
    const highlightedMessage = TextFormatter.highlightBackticks(message.text)
    const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`

    return TextFormatter.dimAnsiCodes(diagnosticText)
  }

  private getSeverityText(severity: DiagnosticSeverity): string {
    return colorize(colorize(severity, severityColor(severity)), "bold")
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
}
