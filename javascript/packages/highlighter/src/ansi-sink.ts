import { colorize, hyperlink, severityColor } from "./color.js"
import { visibleWidth, ANSI_REGEX_START, ANSI_ESCAPE } from "./ansi.js"
import { dimStyledText, applyBackground, sliceStyled } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import { TextFormatter } from "./text-formatter.js"
import * as gutter from "./gutter.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { ColorScheme } from "./themes.js"
import type {
  AnnotationMessage,
  CodeBlockNode,
  DiagnosticHeaderNode,
  DiffBlockNode,
  DiffHunkInfo,
  DiffRowInfo,
  Document,
  FileHeaderNode,
  ProgressRuleNode,
} from "./document.js"

export interface AnsiSinkOptions {
  showLineNumbers: boolean
  wrapLines: boolean
  truncateLines: boolean
  maxWidth: number
  removedLineStyle?: "tint" | "dim" | "none"
  singleLineStyle?: "split" | "inline" | "auto"
  layout?: "unified" | "split"
  indent?: string
}

const COLUMN_DIVIDER_WIDTH = 3
const AUTO_MAX_SPAN = 24
const AUTO_MAX_CHANGE_RATIO = 0.4

const ADDED_COLOR = "green"
const REMOVED_COLOR = "red"

export class AnsiSink {
  private syntaxRenderer: SyntaxRenderer
  private options: AnsiSinkOptions
  private colors?: ColorScheme

  constructor(syntaxRenderer: SyntaxRenderer, options: AnsiSinkOptions, colors?: ColorScheme) {
    this.syntaxRenderer = syntaxRenderer
    this.options = options
    this.colors = colors
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
      } else if (node.type === "FileHeader" && nodes[i + 1]?.type === "DiffBlock") {
        groups.push(this.renderDiff(node, nodes[i + 1] as DiffBlockNode))
        i += 2
      } else if (node.type === "FileHeader") {
        const block = nodes[i + 1] as CodeBlockNode

        groups.push(block.kind === "AnnotatedListing" ? this.renderInline(node, block) : this.renderListing(node, block))
        i += 2
      } else if (node.type === "DiffBlock") {
        groups.push(this.renderDiff(null, node))
        i += 1
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

  private renderDiff(fileHeaderNode: FileHeaderNode | null, block: DiffBlockNode): string {
    const indent = this.options.indent ?? ""

    const originalLines = this.syntaxRenderer.resolveRuns(block.originalRuns).split("\n")
    const modifiedLines = this.syntaxRenderer.resolveRuns(block.modifiedRuns).split("\n")

    const header = this.options.showLineNumbers && fileHeaderNode
      ? `${indent}${colorize(fileHeaderNode.path, "cyan")}\n\n`
      : ""

    return header + this.renderDiffBody(block, originalLines, modifiedLines)
  }

  private renderDiffBody(block: DiffBlockNode, originalLines: string[], modifiedLines: string[]): string {
    const { showLineNumbers, truncateLines, maxWidth } = this.options
    const wrapLines = this.options.wrapLines && !truncateLines
    const removedLineStyle = this.options.removedLineStyle ?? "tint"
    const singleLineStyle = this.options.singleLineStyle ?? "split"
    const layout = this.options.layout ?? "unified"
    const indent = this.options.indent ?? ""

    if (layout === "split") {
      const columnWidth = Math.floor((maxWidth - indent.length - COLUMN_DIVIDER_WIDTH) / 2)

      if (columnWidth - gutter.GUTTER_WIDTH >= gutter.MIN_CONTENT_WIDTH) {
        return this.renderDiffSplitLayout(block.hunks, originalLines, modifiedLines, {
          columnWidth,
          removedLineStyle,
          indent,
        })
      }
    }

    const columnSeparator = gutter.separator()
    const availableWidth = showLineNumbers
      ? Math.max(gutter.MIN_CONTENT_WIDTH, maxWidth - gutter.GUTTER_WIDTH - indent.length)
      : Math.max(gutter.MIN_CONTENT_WIDTH, maxWidth - indent.length)

    const gutterPrefix = showLineNumbers ? `${indent}        ${columnSeparator} ` : indent

    let output = ""

    block.hunks.forEach((hunk, hunkIndex) => {
      if (hunkIndex > 0) {
        output += `${gutterPrefix}${colorize("⋮", "gray")}\n`
      }

      const collapsed = singleLineStyle === "split"
        ? new Map<DiffRowInfo, string>()
        : this.collapsedComposites(hunk, originalLines, modifiedLines, singleLineStyle, availableWidth)

      for (const row of hunk.rows) {
        if (row.kind === "added" && collapsed.has(row)) continue

        const composite = collapsed.get(row)

        const highlighted = this.diffContentFor(row, originalLines, modifiedLines)
        const displayLine = composite ?? this.styleDiffContent(highlighted, row, removedLineStyle)
        const linePrefix = showLineNumbers
          ? `${indent}${composite ? this.collapsedDiffGutterFor(row) : this.diffGutterFor(row)}${columnSeparator} `
          : `${indent}${composite ? colorize("± ", "yellow") : this.diffMarkerFor(row)}`

        if (wrapLines) {
          const wrappedLines = LineWrapper.wrapLine(displayLine, availableWidth, "")

          wrappedLines.forEach((wrappedLine, index) => {
            output += index === 0 ? `${linePrefix}${wrappedLine}\n` : `${gutterPrefix}${wrappedLine}\n`
          })
        } else if (truncateLines) {
          output += `${linePrefix}${LineWrapper.truncateLine(displayLine, availableWidth)}\n`
        } else {
          output += `${linePrefix}${displayLine}\n`
        }
      }
    })

    return output.trimEnd()
  }

  private styleDiffContent(
    highlighted: string,
    row: DiffRowInfo,
    removedLineStyle: "tint" | "dim" | "none",
  ): string {
    if (row.kind === "context") return dimStyledText(highlighted)

    if (row.kind === "removed" && removedLineStyle === "dim") {
      return dimStyledText(highlighted)
    }

    const lineColor = row.kind === "added"
      ? this.colors?.DIFF_ADDED_LINE_BACKGROUND
      : (removedLineStyle === "tint" ? this.colors?.DIFF_REMOVED_LINE_BACKGROUND : undefined)

    const rangeColor = row.kind === "added"
      ? this.colors?.DIFF_ADDED_BACKGROUND
      : this.colors?.DIFF_REMOVED_BACKGROUND

    return applyBackground(highlighted, { lineColor, ranges: row.inlineRanges, rangeColor })
  }

  private diffRowsFor(hunk: DiffHunkInfo): { left: DiffRowInfo | null, right: DiffRowInfo | null }[] {
    const rows: { left: DiffRowInfo | null, right: DiffRowInfo | null }[] = []

    let index = 0

    while (index < hunk.rows.length) {
      const row = hunk.rows[index]

      if (row.kind === "context") {
        rows.push({ left: row, right: row })
        index++

        continue
      }

      const removed: DiffRowInfo[] = []

      while (index < hunk.rows.length && hunk.rows[index].kind === "removed") {
        removed.push(hunk.rows[index])
        index++
      }

      const added: DiffRowInfo[] = []

      while (index < hunk.rows.length && hunk.rows[index].kind === "added") {
        added.push(hunk.rows[index])
        index++
      }

      for (let pair = 0; pair < Math.max(removed.length, added.length); pair++) {
        rows.push({ left: removed[pair] ?? null, right: added[pair] ?? null })
      }
    }

    return rows
  }

  private renderDiffSplitLayout(
    hunks: DiffHunkInfo[],
    originalLines: string[],
    modifiedLines: string[],
    options: {
      columnWidth: number
      removedLineStyle: "tint" | "dim" | "none"
      indent: string
    },
  ): string {
    const { columnWidth, removedLineStyle, indent } = options

    const columnSeparator = gutter.separator()
    const divider = ` ${colorize("┃", "gray")} `
    const contentWidth = columnWidth - gutter.GUTTER_WIDTH

    let output = ""

    hunks.forEach((hunk, hunkIndex) => {
      if (hunkIndex > 0) {
        const hunkGutter = `        ${columnSeparator} ${colorize("⋮", "gray")}`

        output += `${indent}${this.padStyled(hunkGutter, columnWidth)}${divider}${hunkGutter}\n`
      }

      for (const { left, right } of this.diffRowsFor(hunk)) {
        const leftCell = this.diffSplitCell(left, "old", originalLines, modifiedLines, removedLineStyle, contentWidth, columnSeparator)
        const rightCell = this.diffSplitCell(right, "new", originalLines, modifiedLines, removedLineStyle, contentWidth, columnSeparator)

        output += `${indent}${this.padStyled(leftCell, columnWidth)}${divider}${rightCell}\n`
      }
    })

    return output.trimEnd()
  }

  private diffSplitCell(
    row: DiffRowInfo | null,
    numbering: "old" | "new",
    originalLines: string[],
    modifiedLines: string[],
    removedLineStyle: "tint" | "dim" | "none",
    contentWidth: number,
    separator: string,
  ): string {
    if (row === null) return `${" ".repeat(8)}${separator} `

    const highlighted = this.diffContentFor(row, originalLines, modifiedLines)
    const styled = this.styleDiffContent(highlighted, row, removedLineStyle)

    return `${this.diffGutterFor(row, numbering)}${separator} ${LineWrapper.truncateLine(styled, contentWidth)}`
  }

  private padStyled(text: string, width: number): string {
    const printableLength = visibleWidth(text)

    return text + " ".repeat(Math.max(0, width - printableLength))
  }

  private collapsedComposites(
    hunk: DiffHunkInfo,
    originalLines: string[],
    modifiedLines: string[],
    style: "inline" | "auto",
    availableWidth: number,
  ): Map<DiffRowInfo, string> {
    const collapsed = new Map<DiffRowInfo, string>()

    if (process.env.NO_COLOR !== undefined) return collapsed

    for (let index = 0; index < hunk.rows.length - 1; index++) {
      const removed = hunk.rows[index]
      const candidate = removed.collapse

      if (candidate === null) continue

      const added = hunk.rows[index + 1]
      const { start, removedEnd, addedEnd } = candidate

      if (style === "auto" && !this.worthCollapsing(removed.content, added.content, start, removedEnd, addedEnd, availableWidth)) continue

      const removedText = originalLines[removed.oldLine! - 1] ?? removed.content
      const addedText = modifiedLines[added.newLine! - 1] ?? added.content

      const prefix = sliceStyled(addedText, 0, start)
      const suffix = sliceStyled(addedText, addedEnd, added.content.length)

      const removedSpan = removedEnd > start
        ? applyBackground(sliceStyled(removedText, start, removedEnd), { lineColor: this.colors?.DIFF_REMOVED_BACKGROUND })
        : ""

      const addedSpan = addedEnd > start
        ? applyBackground(sliceStyled(addedText, start, addedEnd), { lineColor: this.colors?.DIFF_ADDED_BACKGROUND })
        : ""

      const composite = `${prefix}${removedSpan}${addedSpan}${suffix}`

      collapsed.set(removed, composite)
      collapsed.set(added, composite)

      index++
    }

    return collapsed
  }

  private worthCollapsing(
    removedContent: string,
    addedContent: string,
    start: number,
    removedEnd: number,
    addedEnd: number,
    availableWidth: number,
  ): boolean {
    const removedSpan = removedEnd - start
    const addedSpan = addedEnd - start

    const compositeLength = addedContent.length + removedSpan

    if (compositeLength > availableWidth) return false

    if (removedSpan === 0 || addedSpan === 0) return true

    if (Math.max(removedSpan, addedSpan) > AUTO_MAX_SPAN) return false

    const longestLine = Math.max(removedContent.length, addedContent.length)

    return (removedSpan + addedSpan) <= longestLine * AUTO_MAX_CHANGE_RATIO
  }

  private collapsedDiffGutterFor(row: DiffRowInfo): string {
    const number = (row.oldLine ?? "").toString().padStart(3, " ")

    return `${colorize("  ± ", "yellow")}${colorize(number, "bold")} `
  }

  private diffContentFor(row: DiffRowInfo, originalLines: string[], modifiedLines: string[]): string {
    if (row.kind === "added") {
      return modifiedLines[row.newLine! - 1] ?? row.content
    }

    return originalLines[row.oldLine! - 1] ?? row.content
  }

  private diffMarkerFor(row: DiffRowInfo): string {
    switch (row.kind) {
      case "added": return colorize("+ ", ADDED_COLOR)
      case "removed": return colorize("- ", REMOVED_COLOR)
      case "context": return "  "
    }
  }

  private diffGutterFor(row: DiffRowInfo, numbering: "old" | "new" = "old"): string {
    const lineNumber = numbering === "new" ? row.newLine : row.oldLine
    const number = (lineNumber ?? "").toString().padStart(3, " ")
    const emphasized = lineNumber === null ? number : colorize(number, "bold")

    switch (row.kind) {
      case "added": return `${colorize("  + ", ADDED_COLOR)}${emphasized} `
      case "removed": return `${colorize("  - ", REMOVED_COLOR)}${emphasized} `
      case "context": return `    ${colorize(number, "gray")} `
    }
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
