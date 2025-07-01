import { colorize } from "./color.js"
import { applyDimToStyledText } from "./util.js"

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

  renderWithLineNumbers(path: string, content: string): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)
    const lines = highlightedContent.split("\n")

    let output = `${colorize(path, "cyan")}\n\n`

    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1] || ""
      const lineNumber = colorize(i.toString().padStart(3, " "), "gray")
      const separator = colorize("│", "gray")

      output += `    ${lineNumber} ${separator} ${line}\n`
    }

    return output.trimEnd()
  }

  renderWithFocusLine(path: string, content: string, focusLine: number, contextLines: number, showLineNumbers = true): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)
    const lines = highlightedContent.split("\n")

    const startLine = Math.max(1, focusLine - contextLines)
    const endLine = Math.min(lines.length, focusLine + contextLines)

    let output = showLineNumbers ? `${colorize(path, "cyan")}\n\n` : ""

    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i - 1] || ""
      const isFocusLine = i === focusLine

      if (showLineNumbers) {
        const lineNumber = isFocusLine ?
          colorize(i.toString().padStart(3, " "), "bold") :
          colorize(i.toString().padStart(3, " "), "gray")

        const prefix = isFocusLine ?
          colorize("  → ", "cyan") :
          "    "

        const separator = colorize("│", "gray")

        let displayLine = line
        if (!isFocusLine) {
          displayLine = applyDimToStyledText(line)
        }

        output += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      } else {
        let displayLine = line

        if (!isFocusLine) {
          displayLine = applyDimToStyledText(line)
        }

        output += `${displayLine}\n`
      }
    }

    return output.trimEnd()
  }

  renderPlain(content: string): string {
    return this.syntaxRenderer.highlight(content)
  }
}
