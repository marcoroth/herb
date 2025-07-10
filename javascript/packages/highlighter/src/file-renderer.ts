import { colorize } from "./color.js"
import { applyDimToStyledText } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import { GUTTER_WIDTH, MIN_CONTENT_WIDTH } from "./gutter-config.js"

import type { SyntaxRenderer } from "./syntax-renderer.js"

export interface FileRenderOptions {
  showLineNumbers?: boolean
  contextLines?: number
  focusLine?: number
}

export class FileRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  renderWithLineNumbers(path: string, content: string, wrapLines = false, maxWidth = LineWrapper.getTerminalWidth(), truncateLines = false): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)
    const lines = highlightedContent.split("\n")

    let output = `${colorize(path, "cyan")}\n\n`

    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1] || ""
      const lineNumber = colorize(i.toString().padStart(3, " "), "gray")
      const separator = colorize("│", "gray")

      if (wrapLines) {
        const linePrefix = `    ${lineNumber} ${separator} `
        const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
        const wrappedLines = LineWrapper.wrapLine(line, availableWidth, "")

        for (let j = 0; j < wrappedLines.length; j++) {
          if (j === 0) {
            output += `${linePrefix}${wrappedLines[j]}\n`
          } else {
            output += `        ${separator} ${wrappedLines[j]}\n`
          }
        }
      } else if (truncateLines) {
        const linePrefix = `    ${lineNumber} ${separator} `
        const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
        const truncatedLine = LineWrapper.truncateLine(line, availableWidth)

        output += `${linePrefix}${truncatedLine}\n`
      } else {
        output += `    ${lineNumber} ${separator} ${line}\n`
      }
    }

    return output.trimEnd()
  }

  renderWithFocusLine(
    path: string,
    content: string,
    focusLine: number,
    contextLines: number,
    showLineNumbers = true,
    maxWidth = LineWrapper.getTerminalWidth(),
    wrapLines = false,
    truncateLines = false,
  ): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)
    const lines = highlightedContent.split("\n")

    const startLine = Math.max(1, focusLine - contextLines)
    const endLine = Math.min(lines.length, focusLine + contextLines)

    let output = showLineNumbers ? `${colorize(path, "cyan")}\n\n` : ""

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1] || ""
      const isFocusLine = i === focusLine

      if (showLineNumbers) {
        const lineNumber = isFocusLine
          ? colorize(i.toString().padStart(3, " "), "bold")
          : colorize(i.toString().padStart(3, " "), "gray")

        const prefix = isFocusLine ? colorize("  → ", "cyan") : "    "

        const separator = colorize("│", "gray")

        let displayLine = line

        if (!isFocusLine) {
          displayLine = applyDimToStyledText(line)
        }

        if (wrapLines) {
          const linePrefix = `${prefix}${lineNumber} ${separator} `
          const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
          const wrappedLines = LineWrapper.wrapLine(displayLine, availableWidth, "")

          for (let j = 0; j < wrappedLines.length; j++) {
            if (j === 0) {
              output += `${linePrefix}${wrappedLines[j]}\n`
            } else {
              output += `        ${separator} ${wrappedLines[j]}\n`
            }
          }
        } else if (truncateLines) {
          const linePrefix = `${prefix}${lineNumber} ${separator} `
          const availableWidth = Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
          const truncatedLine = LineWrapper.truncateLine(displayLine, availableWidth)
          output += `${linePrefix}${truncatedLine}\n`
        } else {
          output += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
        }
      } else {
        let displayLine = line

        if (!isFocusLine) {
          displayLine = applyDimToStyledText(line)
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

  renderPlain(content: string, maxWidth = LineWrapper.getTerminalWidth(), wrapLines = false, truncateLines = false): string {
    const highlighted = this.syntaxRenderer.highlight(content)

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
}
