export interface Clause {
  event: string | null
  rest: string
}

export function clauses(value: string): Clause[] {
  return splitOutsideQuotes(value.trim(), " ")
    .filter((part) => part.length > 0)
    .map((part) => {
      const arrow = part.indexOf("->")

      if (arrow === -1) {
        return { event: null, rest: part }
      }

      return { event: part.slice(0, arrow), rest: part.slice(arrow + 2) }
    })
}

export function names(rest: string): string[] {
  const name = rest.trim()

  return name.length > 0 ? [name] : []
}

export function balancedQuotes(source: string): boolean {
  let quoted = false

  for (let position = 0; position < source.length; position += 1) {
    if (source[position] === "'" && source[position - 1] !== "\\") {
      quoted = !quoted
    }
  }

  return !quoted
}

export function splitOutsideQuotes(source: string, separator: string): string[] {
  const parts: string[] = []
  let current = ""
  let quoted = false

  for (let position = 0; position < source.length; position += 1) {
    const character = source[position]

    if (character === "'" && source[position - 1] !== "\\") {
      quoted = !quoted
      current += character

      continue
    }

    if (character === separator && !quoted) {
      parts.push(current)
      current = ""

      continue
    }

    current += character
  }

  parts.push(current)

  return parts
}

export function unquote(raw: string): string {
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/\\'/g, "'")
  }

  return raw
}
