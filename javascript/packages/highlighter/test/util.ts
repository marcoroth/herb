import { ANSI_REGEX } from "../src/ansi.js"

export const stripAnsiColors = (text: string): string => {
  return text.replace(ANSI_REGEX, "")
}
