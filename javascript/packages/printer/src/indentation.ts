export type IndentType = "spaces" | "tabs"

const LEADING_BLANKS = /^[^\S\n]*/

/**
 * Convert the leading indentation of every line in `source` between spaces and tabs.
 *
 * Only whole `indentWidth`-space groups are converted to tabs; any remainder
 * (e.g. alignment padding that isn't a full indent level) is left as spaces.
 * Existing tabs are expanded to `indentWidth` spaces before conversion, so
 * mixed indentation is normalized regardless of the target `indentType`.
 */
export function convertIndentation(source: string, indentWidth: number, indentType: IndentType): string {
  const lines = source.split("\n")

  const result = lines.map((line) => {
    const match = line.match(LEADING_BLANKS)

    if (!match || match[0].length === 0) return line

    const leading = match[0]
    const normalized = leading.replace(/\t/g, " ".repeat(indentWidth))

    const replaced = indentType === "tabs"
      ? "\t".repeat(Math.floor(normalized.length / indentWidth)) + " ".repeat(normalized.length % indentWidth)
      : normalized

    return replaced + line.substring(leading.length)
  })

  return result.join("\n")
}
