import { colors } from "./color.js"
import { ANSI_REGEX } from "./ansi.js"

export class TextFormatter {
  static dimAnsiCodes(text: string): string {
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

  static replaceBackticks(text: string, open: string, close: string): string {
    return text.replace(/`([^`]+)`/g, (_match, inner) => `${open}${inner}${close}`)
  }

  static highlightBackticks(text: string): string {
    if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      return TextFormatter.replaceBackticks(text, `${colors.bold}${colors.white}`, colors.reset)
    }
    return text
  }
}