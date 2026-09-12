export function asList<T>(value: T | T[]): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return [value]
}

export function last<T>(open: T[]): T | undefined {
  return open[open.length - 1]
}

export function popMatching<T>(open: T[], matches: (candidate: T) => boolean): T | null {
  for (let position = open.length - 1; position >= 0; position -= 1) {
    if (matches(open[position])) {
      return open.splice(position, 1)[0]
    }
  }

  return null
}
