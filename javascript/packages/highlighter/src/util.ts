import { colors, ANSI_REGEX_START, ANSI_REGEX_CAPTURE } from "./color.js"

export function applyDimToStyledText(text: string): string {
  const isColorEnabled = process.env.NO_COLOR === undefined

  if (!isColorEnabled) return text

  const parts = text.split(ANSI_REGEX_CAPTURE)

  let result = ""

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part.match(ANSI_REGEX_START)) {
      if (part === colors.reset) {
        result += part
      } else {
        const codes = part.slice(2, -1)

        if (codes && codes !== "0" && codes !== "") {
          result += `\x1b[2;${codes}m`
        } else {
          result += part
        }
      }
    } else if (part.length > 0) {
      result += `${colors.dim}${part}\x1b[22m`
    }
  }

  return result
}
