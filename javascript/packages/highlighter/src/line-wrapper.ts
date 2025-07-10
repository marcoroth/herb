import { colorize } from "./color.js"

export class LineWrapper {
  static wrapLine(line: string, maxWidth: number, indent: string = ""): string[] {
    if (maxWidth <= 0) return [line]

    // Strip ANSI codes for width calculation but preserve them in output
    const ansiRegex = /\x1b\[[0-9;]*m/g
    const plainLine = line.replace(ansiRegex, "")

    if (plainLine.length <= maxWidth) {
      return [line]
    }

    const wrappedLines: string[] = []
    let currentLine = line
    let currentPlain = plainLine

    while (currentPlain.length > maxWidth) {
      // Find a good break point (prefer spaces, then other characters)
      let breakPoint = maxWidth

      // Look for space or other break characters within maxWidth
      // First pass: look for whitespace (ideal breaks)
      for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 40); i--) {
        const char = currentPlain[i]
        if (char === " " || char === "\t") {
          breakPoint = i + 1 // Break after whitespace
          break
        }
      }

      // Second pass: if no whitespace found, look for punctuation but not within quoted strings
      if (breakPoint === maxWidth) {
        for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 30); i--) {
          const char = currentPlain[i]
          // Avoid breaking inside quoted strings or immediately after =
          const prevChar = i > 0 ? currentPlain[i - 1] : ""
          const nextChar = i < currentPlain.length - 1 ? currentPlain[i + 1] : ""

          if ((char === ">" || char === "," || char === ";") &&
              prevChar !== "=" && nextChar !== "\"" && nextChar !== "'") {
            breakPoint = i + 1
            break
          }
        }
      }

      // Third pass: if still no good break point, break at maxWidth but try to avoid =
      if (breakPoint === maxWidth) {
        for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 10); i--) {
          const char = currentPlain[i]
          if (char !== "=" && char !== "\"" && char !== "'") {
            breakPoint = i
            break
          }
        }
      }

      // Extract the portion to wrap
      const wrapPortion = this.extractPortionWithAnsi(currentLine, breakPoint)
      wrappedLines.push(wrapPortion)

      // Update remaining text
      currentLine = this.extractRemainingWithAnsi(currentLine, currentPlain, breakPoint)
      currentPlain = currentPlain.slice(breakPoint).trimStart()

      // Add indent to continuation lines
      if (currentPlain.length > 0) {
        currentLine = indent + currentLine.trimStart()
      }
    }

    // Add the remaining text
    if (currentPlain.length > 0) {
      wrappedLines.push(currentLine)
    }

    return wrappedLines
  }

  private static extractPortionWithAnsi(styledLine: string, endIndex: number): string {
    let styledIndex = 0
    let plainIndex = 0
    let result = ""

    while (plainIndex < endIndex && styledIndex < styledLine.length) {
      const char = styledLine[styledIndex]

      if (char === "\x1b") {
        // Copy ANSI escape sequence
        const ansiMatch = styledLine.slice(styledIndex).match(/^\x1b\[[0-9;]*m/)
        if (ansiMatch) {
          result += ansiMatch[0]
          styledIndex += ansiMatch[0].length
          continue
        }
      }

      result += char
      styledIndex++
      plainIndex++
    }

    return result
  }

  private static extractRemainingWithAnsi(styledLine: string, plainLine: string, startIndex: number): string {
    let styledIndex = 0
    let plainIndex = 0

    // Find the styled position corresponding to plain position
    while (plainIndex < startIndex && styledIndex < styledLine.length) {
      const char = styledLine[styledIndex]

      if (char === "\x1b") {
        // Skip ANSI escape sequence
        const ansiMatch = styledLine.slice(styledIndex).match(/^\x1b\[[0-9;]*m/)
        if (ansiMatch) {
          styledIndex += ansiMatch[0].length
          continue
        }
      }

      styledIndex++
      plainIndex++
    }

    return styledLine.slice(styledIndex)
  }

  static truncateLine(line: string, maxWidth: number): string {
    if (maxWidth <= 0) return line

    // Strip ANSI codes for width calculation but preserve them in output
    const ansiRegex = /\x1b\[[0-9;]*m/g
    const plainLine = line.replace(ansiRegex, "")

    if (plainLine.length <= maxWidth) {
      return line
    }

    // Reserve space for ellipsis and some padding from the right edge
    const ellipsisChar = "…"
    const ellipsis = colorize(ellipsisChar, "dim")
    const rightPadding = 2 // Leave some breathing room from the right edge
    const availableWidth = maxWidth - ellipsisChar.length - rightPadding

    if (availableWidth <= 0) {
      return ellipsis
    }

    // Extract the portion that fits with ANSI codes preserved
    const truncatedPortion = this.extractPortionWithAnsi(line, availableWidth)

    // Add ellipsis (without color codes to avoid issues)
    return truncatedPortion + ellipsis
  }

  static getTerminalWidth(): number {
    if (process.stdout.isTTY && process.stdout.columns) {
      return process.stdout.columns
    }
    return 80 // Default fallback
  }
}
