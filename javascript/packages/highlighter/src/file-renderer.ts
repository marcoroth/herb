import { colorize } from "./color.js"
import { dimStyledText } from "./util.js"
import { LineWrapper } from "./line-wrapper.js"
import * as gutter from "./gutter.js"

import type { SyntaxRenderer } from "./syntax-renderer.js"

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
