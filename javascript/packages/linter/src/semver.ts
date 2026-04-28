export type SemverVersion = `${number}.${number}.${number}`
export type RuleVersion = SemverVersion | "unreleased"

export const UNRELEASED_VERSION: RuleVersion = "unreleased"

export function parseSemver(version: string): [number, number, number] {
  const parts = version.split(".")

  if (parts.length < 2 || parts.length > 3) {
    return [0, 0, 0]
  }

  const major = parseInt(parts[0], 10)
  const minor = parseInt(parts[1], 10)
  const patch = parts[2] !== undefined ? parseInt(parts[2], 10) : 0

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    return [0, 0, 0]
  }

  return [major, minor, patch]
}

export function compareSemver(a: string, b: string): number {
  if (a === UNRELEASED_VERSION && b === UNRELEASED_VERSION) return 0
  if (a === UNRELEASED_VERSION) return 1
  if (b === UNRELEASED_VERSION) return -1

  const [majorA, minorA, patchA] = parseSemver(a)
  const [majorB, minorB, patchB] = parseSemver(b)

  if (majorA !== majorB) return majorA - majorB
  if (minorA !== minorB) return minorA - minorB

  return patchA - patchB
}

export function semverGreaterThan(a: string, b: string): boolean {
  return compareSemver(a, b) > 0
}
