export class TextFormatter {
  static applyDimToStyledText(text: string): string {
    const isColorEnabled = process.env.NO_COLOR === undefined
    if (!isColorEnabled) return text

    return text.replace(/\x1b\[([0-9;]*)m/g, (match, codes) => {
      if (codes === "0" || codes === "") {
        return match
      }

      return `\x1b[2;${codes}m`
    })
  }

  static highlightBackticks(text: string): string {
    if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      const boldWhite = "\x1b[1m\x1b[37m"
      const reset = "\x1b[0m"
      return text.replace(/`([^`]+)`/g, `${boldWhite}$1${reset}`)
    }
    return text
  }
}