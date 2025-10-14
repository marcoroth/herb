import { colorize } from "./color.js"

export class LineWrapper {
  static wrapLine(line: string, maxWidth: number, indent: string = ""): string[] {
    if (maxWidth <= 0) return [line]

    const ansiRegex = /\x1b\[[0-9;]*m/g
    const plainLine = line.replace(ansiRegex, "")

    if (plainLine.length <= maxWidth) {
      return [line]
    }

    const wrappedLines: string[] = []
    let currentLine = line
    let currentPlain = plainLine

    while (currentPlain.length > maxWidth) {
      let breakPoint = maxWidth

      // First pass: look for whitespace (ideal breaks)
      for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 40); i--) {
        const char = currentPlain[i]
        if (char === " " || char === "\t") {
          breakPoint = i + 1
          break
        }
      }

      // Second pass: if no whitespace found, look for punctuation but not within quoted strings
      if (breakPoint === maxWidth) {
        for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 30); i--) {
          const char = currentPlain[i]
          const prevChar = i > 0 ? currentPlain[i - 1] : ""
          const nextChar = i < currentPlain.length - 1 ? currentPlain[i + 1] : ""

          if ((char === ">" || char === "," || char === ";") &&
              prevChar !== "=" && nextChar !== "\"" && nextChar !== "'") {
            breakPoint = i + 1
            break
          }
        }
      }

      if (breakPoint === maxWidth) {
        for (let i = maxWidth - 1; i >= Math.max(0, maxWidth - 10); i--) {
          const char = currentPlain[i]

          if (char !== "=" && char !== "\"" && char !== "'") {
            breakPoint = i
            break
          }
        }
      }

      const wrapPortion = this.extractPortionWithAnsi(currentLine, breakPoint)

      wrappedLines.push(wrapPortion)
      currentLine = this.extractRemainingWithAnsi(currentLine, currentPlain, breakPoint)
      currentPlain = currentPlain.slice(breakPoint).trimStart()

      if (currentPlain.length > 0) {
        currentLine = indent + currentLine.trimStart()
      }
    }

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

  private static extractRemainingWithAnsi(styledLine: string, _plainLine: string, startIndex: number): string {
    let styledIndex = 0
    let plainIndex = 0

    while (plainIndex < startIndex && styledIndex < styledLine.length) {
      const char = styledLine[styledIndex]

      if (char === "\x1b") {
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
    const ansiRegex = /\x1b\[[0-9;]*m/g
    const plainLine = line.replace(ansiRegex, "")

    if (plainLine.length <= maxWidth) {
      return line
    }

    const ellipsisChar = "…"
    const ellipsis = colorize(ellipsisChar, "dim")
    const rightPadding = 2
    const availableWidth = maxWidth - ellipsisChar.length - rightPadding

    if (availableWidth <= 0) {
      return ellipsis
    }

    const truncatedPortion = this.extractPortionWithAnsi(line, availableWidth)

    return truncatedPortion + ellipsis
  }

  static getTerminalWidth(): number {
    if (process.stdout.isTTY && process.stdout.columns) {
      return process.stdout.columns
    }

    return 80
  }
}
