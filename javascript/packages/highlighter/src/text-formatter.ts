import { colors, ANSI_REGEX } from "./color.js"

export class TextFormatter {
  static applyDimToStyledText(text: string): string {
    const isColorEnabled = process.env.NO_COLOR === undefined
    if (!isColorEnabled) return text

    return text.replace(ANSI_REGEX, (match) => {
      const codes = match.slice(2, -1)

      if (codes === "0" || codes === "") {
        return match
      }

      return `\x1b[2;${codes}m`
    })
  }

  static highlightBackticks(text: string): string {
    if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      return text.replace(/`([^`]+)`/g, `${colors.bold}${colors.white}$1${colors.reset}`)
    }
    return text
  }
}