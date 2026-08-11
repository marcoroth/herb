export function omit(object: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const result = { ...object }

  for (const key of keys) {
    delete result[key]
  }

  return result
}
