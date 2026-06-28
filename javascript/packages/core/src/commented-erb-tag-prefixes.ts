export function commentedERBTagPrefixes(defaultOpenings: string[], erbOpeners: string[]): string[] {
  const defaultPrefixes = defaultOpenings
    .map(opening => opening.slice("<%".length))
    .filter(prefix => prefix !== "" && prefix !== "#")

  return [...erbOpeners, ...defaultPrefixes].sort((a, b) => b.length - a.length)
}
