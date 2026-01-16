/**
 * Checks if parentheses in a string are balanced
 * Returns false if there are more closing parens than opening at any point
 */
export function hasBalancedParentheses(content: string): boolean {
  let depth = 0

  for (const char of content) {
    if (char === "(") depth++
    if (char === ")") depth--
    if (depth < 0) return false
  }

  return depth === 0
}

/**
 * Splits a string by commas at the top level only
 * Respects nested parentheses, brackets, braces, and strings
 *
 * @example
 * splitByTopLevelComma("a, b, c") // ["a", " b", " c"]
 * splitByTopLevelComma("a, (b, c), d") // ["a", " (b, c)", " d"]
 * splitByTopLevelComma('a, "b, c", d') // ["a", ' "b, c"', " d"]
 */
export function splitByTopLevelComma(str: string): string[] {
  const result: string[] = []

  let current = ""
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let stringChar = ""

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const previousChar = i > 0 ? str[i - 1] : ""

    if ((char === '"' || char === "'") && previousChar !== "\\") {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
      }
    }

    if (!inString) {
      if (char === "(") parenDepth++
      if (char === ")") parenDepth--
      if (char === "[") bracketDepth++
      if (char === "]") bracketDepth--
      if (char === "{") braceDepth++
      if (char === "}") braceDepth--

      if (char === "," && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        result.push(current)
        current = ""
        continue
      }
    }

    current += char
  }

  if (current) {
    result.push(current)
  }

  return result
}
