import { colorize, ANSI_REGEX } from "./color.js"
import { applyDimToStyledText, applyBackground, sliceStyled } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import { GUTTER_WIDTH, MIN_CONTENT_WIDTH } from "./gutter-config.js"
import { computeDiffHunks, computeInlineRanges } from "./diff-computer.js"

import type { DiffHunk, DiffLine, InlineRange } from "./diff-computer.js"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { ColorScheme } from "./themes.js"

export interface DiffRenderOptions {
  contextLines?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  highlightInlineChanges?: boolean
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

export class DiffRenderer {
  private syntaxRenderer: SyntaxRenderer
  private colors: ColorScheme

  constructor(syntaxRenderer: SyntaxRenderer, colors: ColorScheme) {
    this.syntaxRenderer = syntaxRenderer
    this.colors = colors
  }

  /**
   * Render the change between two sources as a syntax-highlighted diff.
   *
   * @param path - File path shown above the diff, omitted when empty
   * @param original - The source before the change
   * @param modified - The source after the change
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when the sources are identical
   */
  render(path: string, original: string, modified: string, options: DiffRenderOptions = {}): string {
    const {
      contextLines = 2,
      showLineNumbers = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
      highlightInlineChanges = true,
      removedLineStyle = "tint",
      singleLineStyle = "split",
      layout = "unified",
      indent = "",
    } = options

    const hunks = computeDiffHunks(original, modified, contextLines)

    if (hunks.length === 0) return ""

    const originalLines = this.syntaxRenderer.highlight(original).split("\n")
    const modifiedLines = this.syntaxRenderer.highlight(modified).split("\n")

    const header = showLineNumbers && path ? `${indent}${colorize(path, "cyan")}\n\n` : ""

    return header + this.renderHunks(hunks, originalLines, modifiedLines, {
      showLineNumbers,
      wrapLines: wrapLines && !truncateLines,
      truncateLines,
      maxWidth,
      highlightInlineChanges,
      removedLineStyle,
      singleLineStyle,
      layout,
      indent,
    })
  }

  /**
   * Render hunks without the sources they came from, reconstructing each side from the line
   * contents the hunks carry.
   *
   * Use this for hunks that arrived over a wire or were parsed from a unified diff. Each
   * side is highlighted as a standalone block, so a hunk that begins part-way through a tag
   * may lex slightly differently than it would with the whole file in hand.
   *
   * @param path - File path shown above the diff, omitted when empty
   * @param hunks - The hunks to render
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when there are no hunks
   */
  renderFromHunks(path: string, hunks: DiffHunk[], options: DiffRenderOptions = {}): string {
    if (hunks.length === 0) return ""

    const {
      showLineNumbers = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
      highlightInlineChanges = true,
      removedLineStyle = "tint",
      singleLineStyle = "split",
      layout = "unified",
      indent = "",
    } = options

    const originalLines: string[] = []
    const modifiedLines: string[] = []

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.oldLineNumber !== null) originalLines[line.oldLineNumber - 1] = line.content
        if (line.newLineNumber !== null) modifiedLines[line.newLineNumber - 1] = line.content
      }
    }

    const highlight = (lines: string[]) => {
      const filled = Array.from(lines, line => line ?? "")

      return this.syntaxRenderer.highlight(filled.join("\n")).split("\n")
    }

    const header = showLineNumbers && path ? `${indent}${colorize(path, "cyan")}\n\n` : ""

    return header + this.renderHunks(hunks, highlight(originalLines), highlight(modifiedLines), {
      showLineNumbers,
      wrapLines: wrapLines && !truncateLines,
      truncateLines,
      maxWidth,
      highlightInlineChanges,
      removedLineStyle,
      singleLineStyle,
      layout,
      indent,
    })
  }

  renderHunks(
    hunks: DiffHunk[],
    highlightedOriginalLines: string[],
    highlightedModifiedLines: string[],
    options: {
      showLineNumbers: boolean
      wrapLines: boolean
      truncateLines: boolean
      maxWidth: number
      highlightInlineChanges: boolean
      removedLineStyle: "tint" | "dim" | "none"
      singleLineStyle: "split" | "inline" | "auto"
      layout: "unified" | "split"
      indent: string
    },
  ): string {
    const { showLineNumbers, wrapLines, truncateLines, maxWidth, highlightInlineChanges, removedLineStyle, singleLineStyle, layout, indent } = options

    if (layout === "split") {
      const columnWidth = Math.floor((maxWidth - indent.length - COLUMN_DIVIDER_WIDTH) / 2)

      if (columnWidth - GUTTER_WIDTH >= MIN_CONTENT_WIDTH) {
        return this.renderSplitLayout(hunks, highlightedOriginalLines, highlightedModifiedLines, {
          columnWidth,
          highlightInlineChanges,
          removedLineStyle,
          indent,
        })
      }
    }

    const separator = colorize("│", "gray")
    const availableWidth = showLineNumbers
      ? Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH - indent.length)
      : Math.max(MIN_CONTENT_WIDTH, maxWidth - indent.length)

    const gutterPrefix = showLineNumbers ? `${indent}        ${separator} ` : indent

    let output = ""

    hunks.forEach((hunk, hunkIndex) => {
      if (hunkIndex > 0) {
        output += `${gutterPrefix}${colorize("⋮", "gray")}\n`
      }

      const inlineRanges = highlightInlineChanges ? this.inlineRangesFor(hunk) : new Map<DiffLine, InlineRange[]>()

      const collapsed = singleLineStyle === "split"
        ? new Map<DiffLine, string>()
        : this.collapsibleLines(hunk, inlineRanges, highlightedOriginalLines, highlightedModifiedLines, singleLineStyle, availableWidth)

      for (const line of hunk.lines) {
        if (line.type === "added" && collapsed.has(line)) continue

        const composite = collapsed.get(line)

        const highlighted = this.highlightedContentFor(line, highlightedOriginalLines, highlightedModifiedLines)
        const displayLine = composite ?? this.styleContent(highlighted, line, inlineRanges.get(line), removedLineStyle)
        const linePrefix = showLineNumbers
          ? `${indent}${composite ? this.collapsedGutterFor(line) : this.gutterFor(line)}${separator} `
          : `${indent}${composite ? colorize("± ", "yellow") : this.markerFor(line)}`

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

  private inlineRangesFor(hunk: DiffHunk): Map<DiffLine, InlineRange[]> {
    const ranges = new Map<DiffLine, InlineRange[]>()

    let index = 0

    while (index < hunk.lines.length) {
      if (hunk.lines[index].type !== "removed") {
        index++
        continue
      }

      const removed: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "removed") {
        removed.push(hunk.lines[index])
        index++
      }

      const added: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "added") {
        added.push(hunk.lines[index])
        index++
      }

      if (removed.length !== added.length) continue

      for (let pair = 0; pair < removed.length; pair++) {
        const { removed: removedRanges, added: addedRanges } = computeInlineRanges(removed[pair].content, added[pair].content)

        if (removedRanges.length > 0 || addedRanges.length > 0) {
          ranges.set(removed[pair], removedRanges)
          ranges.set(added[pair], addedRanges)
        }
      }
    }

    return ranges
  }

  private styleContent(
    highlighted: string,
    line: DiffLine,
    ranges: InlineRange[] | undefined,
    removedLineStyle: "tint" | "dim" | "none",
  ): string {
    if (line.type === "context") return applyDimToStyledText(highlighted)

    if (line.type === "removed" && removedLineStyle === "dim") {
      return applyDimToStyledText(highlighted)
    }

    const lineColor = line.type === "added"
      ? this.colors.DIFF_ADDED_LINE_BACKGROUND
      : (removedLineStyle === "tint" ? this.colors.DIFF_REMOVED_LINE_BACKGROUND : undefined)

    const rangeColor = line.type === "added"
      ? this.colors.DIFF_ADDED_BACKGROUND
      : this.colors.DIFF_REMOVED_BACKGROUND

    return applyBackground(highlighted, { lineColor, ranges, rangeColor })
  }

  private rowsFor(hunk: DiffHunk): { left: DiffLine | null, right: DiffLine | null }[] {
    const rows: { left: DiffLine | null, right: DiffLine | null }[] = []

    let index = 0

    while (index < hunk.lines.length) {
      const line = hunk.lines[index]

      if (line.type === "context") {
        rows.push({ left: line, right: line })
        index++

        continue
      }

      const removed: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "removed") {
        removed.push(hunk.lines[index])
        index++
      }

      const added: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "added") {
        added.push(hunk.lines[index])
        index++
      }

      for (let row = 0; row < Math.max(removed.length, added.length); row++) {
        rows.push({ left: removed[row] ?? null, right: added[row] ?? null })
      }
    }

    return rows
  }

  private renderSplitLayout(
    hunks: DiffHunk[],
    highlightedOriginalLines: string[],
    highlightedModifiedLines: string[],
    options: {
      columnWidth: number
      highlightInlineChanges: boolean
      removedLineStyle: "tint" | "dim" | "none"
      indent: string
    },
  ): string {
    const { columnWidth, highlightInlineChanges, removedLineStyle, indent } = options

    const separator = colorize("│", "gray")
    const divider = ` ${colorize("┃", "gray")} `
    const contentWidth = columnWidth - GUTTER_WIDTH

    let output = ""

    hunks.forEach((hunk, hunkIndex) => {
      const inlineRanges = highlightInlineChanges ? this.inlineRangesFor(hunk) : new Map<DiffLine, InlineRange[]>()

      if (hunkIndex > 0) {
        const gutter = `        ${separator} ${colorize("⋮", "gray")}`

        output += `${indent}${this.padStyled(gutter, columnWidth)}${divider}${gutter}\n`
      }

      for (const { left, right } of this.rowsFor(hunk)) {
        const leftCell = this.splitCell(left, "old", highlightedOriginalLines, highlightedModifiedLines, inlineRanges, removedLineStyle, contentWidth, separator)
        const rightCell = this.splitCell(right, "new", highlightedOriginalLines, highlightedModifiedLines, inlineRanges, removedLineStyle, contentWidth, separator)

        output += `${indent}${this.padStyled(leftCell, columnWidth)}${divider}${rightCell}\n`
      }
    })

    return output.trimEnd()
  }

  private splitCell(
    line: DiffLine | null,
    numbering: "old" | "new",
    originalLines: string[],
    modifiedLines: string[],
    inlineRanges: Map<DiffLine, InlineRange[]>,
    removedLineStyle: "tint" | "dim" | "none",
    contentWidth: number,
    separator: string,
  ): string {
    if (line === null) return `${" ".repeat(8)}${separator} `

    const highlighted = this.highlightedContentFor(line, originalLines, modifiedLines)
    const styled = this.styleContent(highlighted, line, inlineRanges.get(line), removedLineStyle)

    return `${this.gutterFor(line, numbering)}${separator} ${LineWrapper.truncateLine(styled, contentWidth)}`
  }

  private padStyled(text: string, width: number): string {
    const printableLength = text.replace(ANSI_REGEX, "").length

    return text + " ".repeat(Math.max(0, width - printableLength))
  }

  private collapsibleLines(
    hunk: DiffHunk,
    inlineRanges: Map<DiffLine, InlineRange[]>,
    originalLines: string[],
    modifiedLines: string[],
    style: "inline" | "auto",
    availableWidth: number,
  ): Map<DiffLine, string> {
    const collapsed = new Map<DiffLine, string>()

    if (process.env.NO_COLOR !== undefined) return collapsed

    for (let index = 0; index < hunk.lines.length - 1; index++) {
      const removed = hunk.lines[index]
      const added = hunk.lines[index + 1]

      if (removed.type !== "removed" || added.type !== "added") continue
      if (hunk.lines[index + 2]?.type === "added") continue
      if (index > 0 && hunk.lines[index - 1].type === "removed") continue

      const removedRanges = inlineRanges.get(removed)
      const addedRanges = inlineRanges.get(added)

      if (!removedRanges || !addedRanges) continue
      if (removedRanges.length > 1 || addedRanges.length > 1) continue
      if (removedRanges.length === 0 && addedRanges.length === 0) continue

      const start = Math.min(removedRanges[0]?.start ?? Infinity, addedRanges[0]?.start ?? Infinity)

      const removedEnd = removedRanges[0]?.end ?? start
      const addedEnd = addedRanges[0]?.end ?? start

      if (style === "auto" && !this.worthCollapsing(removed, added, start, removedEnd, addedEnd, availableWidth)) continue

      const removedText = originalLines[removed.oldLineNumber! - 1] ?? removed.content
      const addedText = modifiedLines[added.newLineNumber! - 1] ?? added.content

      const prefix = sliceStyled(addedText, 0, start)
      const suffix = sliceStyled(addedText, addedEnd, added.content.length)

      const removedSpan = removedEnd > start
        ? applyBackground(sliceStyled(removedText, start, removedEnd), { lineColor: this.colors.DIFF_REMOVED_BACKGROUND })
        : ""

      const addedSpan = addedEnd > start
        ? applyBackground(sliceStyled(addedText, start, addedEnd), { lineColor: this.colors.DIFF_ADDED_BACKGROUND })
        : ""

      const composite = `${prefix}${removedSpan}${addedSpan}${suffix}`

      collapsed.set(removed, composite)
      collapsed.set(added, composite)

      index++
    }

    return collapsed
  }

  private worthCollapsing(
    removed: DiffLine,
    added: DiffLine,
    start: number,
    removedEnd: number,
    addedEnd: number,
    availableWidth: number,
  ): boolean {
    const removedSpan = removedEnd - start
    const addedSpan = addedEnd - start

    const compositeLength = added.content.length + removedSpan

    if (compositeLength > availableWidth) return false

    if (removedSpan === 0 || addedSpan === 0) return true

    if (Math.max(removedSpan, addedSpan) > AUTO_MAX_SPAN) return false

    const longestLine = Math.max(removed.content.length, added.content.length)

    return (removedSpan + addedSpan) <= longestLine * AUTO_MAX_CHANGE_RATIO
  }

  private collapsedGutterFor(line: DiffLine): string {
    const number = (line.oldLineNumber ?? "").toString().padStart(3, " ")

    return `${colorize("  ± ", "yellow")}${colorize(number, "bold")} `
  }

  private highlightedContentFor(line: DiffLine, originalLines: string[], modifiedLines: string[]): string {
    if (line.type === "added") {
      return modifiedLines[line.newLineNumber! - 1] ?? line.content
    }

    return originalLines[line.oldLineNumber! - 1] ?? line.content
  }

  private markerFor(line: DiffLine): string {
    switch (line.type) {
      case "added": return colorize("+ ", ADDED_COLOR)
      case "removed": return colorize("- ", REMOVED_COLOR)
      case "context": return "  "
    }
  }

  private gutterFor(line: DiffLine, numbering: "old" | "new" = "old"): string {
    const lineNumber = numbering === "new" ? line.newLineNumber : line.oldLineNumber
    const number = (lineNumber ?? "").toString().padStart(3, " ")
    const emphasized = lineNumber === null ? number : colorize(number, "bold")

    switch (line.type) {
      case "added": return `${colorize("  + ", ADDED_COLOR)}${emphasized} `
      case "removed": return `${colorize("  - ", REMOVED_COLOR)}${emphasized} `
      case "context": return `    ${colorize(number, "gray")} `
    }
  }
}
