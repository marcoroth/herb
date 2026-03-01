/**
 * File path and naming utilities for linter rules
 */

/**
 * Extracts the basename (filename) from a file path
 * Works with both forward slashes and backslashes
 */
export function getBasename(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"))

  return lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1)
}

/**
 * Checks if a file is a Rails partial (filename starts with `_`)
 * Returns null if fileName is undefined (unknown context)
 */
export function isPartialFile(fileName: string | undefined): boolean | null {
  if (!fileName) return null

  return getBasename(fileName).startsWith("_")
}
