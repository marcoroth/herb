export function applyDimToStyledText(text: string): string {
  const isColorEnabled = process.env.NO_COLOR === undefined

  if (!isColorEnabled) return text

  const parts = text.split(/(\x1b\[[0-9;]*m)/g)

  let result = ""

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part.match(/^\x1b\[[0-9;]*m$/)) {
      if (part === "\x1b[0m") {
        result += part
      } else {
        const codes = part.match(/\x1b\[([0-9;]*)m/)?.[1]

        if (codes && codes !== "0" && codes !== "") {
          result += `\x1b[2;${codes}m`
        } else {
          result += part
        }
      }
    } else if (part.length > 0) {
      result += `\x1b[2m${part}\x1b[22m`
    }
  }

  return result
}
