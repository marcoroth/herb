/**
 * Utilities for parsing herb:counter comments.
 *
 * Syntax: `<%# herb:counter <RuleName> <NonNegativeInteger> %>`
 *
 * One rule per comment. This mirrors the shape of erblint:counter and avoids
 * the ambiguous count-to-rule mapping that a multi-rule form would introduce.
 * See `./herb-disable-comment-utils.ts` for the sibling helpers this module
 * mirrors structurally.
 */

/**
 * Result of parsing a herb:counter comment.
 */
export interface HerbCounterComment {
  /** The full matched string (trimmed content, or the full `<%# ... %>` when parsed from a line) */
  match: string
  /** The single rule name declared in the comment */
  ruleName: string
  /** Zero-based offset of the rule name within `content` */
  ruleNameOffset: number
  /** Length of the rule name */
  ruleNameLength: number
  /** The declared expected offense count */
  count: number
  /** Zero-based offset of the count within `content` */
  countOffset: number
  /** Length of the count as it appears in the source */
  countLength: number
  /** The original raw text after the `herb:counter` prefix (e.g. "RuleName 12") */
  argsString: string
}

const HERB_COUNTER_PREFIX = "herb:counter"

/**
 * Parse a herb:counter comment from ERB comment content.
 * Use this when you have the content inside `<%# ... %>` (e.g. from
 * `ERBContentNode.content.value`).
 *
 * Returns `null` for malformed input (missing rule name, missing/non-integer
 * count, trailing garbage) so the malformed meta-rule can report it.
 *
 * @param content - The content string without `<%# %>` delimiters
 */
export function parseHerbCounterContent(content: string): HerbCounterComment | null {
  const trimmed = content.trim()

  if (!trimmed.startsWith(HERB_COUNTER_PREFIX)) return null

  const afterPrefixRaw = trimmed.substring(HERB_COUNTER_PREFIX.length)

  // Require whitespace after the prefix
  if (afterPrefixRaw.length === 0) return null
  if (afterPrefixRaw[0] !== ' ' && afterPrefixRaw[0] !== '\t') return null

  const argsString = afterPrefixRaw.trim()
  if (argsString.length === 0) return null

  const parts = argsString.split(/\s+/)
  if (parts.length !== 2) return null

  const [ruleName, countRaw] = parts

  if (ruleName.length === 0) return null
  if (countRaw.length === 0) return null

  // Non-negative integer only. Reject signs, decimals, whitespace, etc.
  if (!/^\d+$/.test(countRaw)) return null

  const count = Number(countRaw)
  if (!Number.isFinite(count) || count < 0) return null

  // Locate offsets within the original (untrimmed) content so meta-rule
  // reporters can pinpoint the rule name and count.
  const argsStart = content.indexOf(argsString, content.indexOf(HERB_COUNTER_PREFIX) + HERB_COUNTER_PREFIX.length)
  const ruleNameOffset = argsStart + argsString.indexOf(ruleName)
  const countOffset = argsStart + argsString.indexOf(countRaw, argsString.indexOf(ruleName) + ruleName.length)

  return {
    match: trimmed,
    ruleName,
    ruleNameOffset,
    ruleNameLength: ruleName.length,
    count,
    countOffset,
    countLength: countRaw.length,
    argsString,
  }
}

/**
 * Parse a herb:counter comment from a full source line.
 * Use this when you have a complete line that may contain
 * `<%# herb:counter ... %>`.
 *
 * @param line - The source line that may contain a herb:counter comment
 */
export function parseHerbCounterLine(line: string): HerbCounterComment | null {
  const startTag = "<%#"
  const endTag = "%>"

  const startIndex = line.indexOf(startTag)
  if (startIndex === -1) return null

  const endIndex = line.indexOf(endTag, startIndex)
  if (endIndex === -1) return null

  const rawContent = line.substring(startIndex + startTag.length, endIndex)
  const parsed = parseHerbCounterContent(rawContent)

  if (!parsed) return null

  const fullMatch = line.substring(startIndex, endIndex + endTag.length)

  return {
    ...parsed,
    match: fullMatch,
  }
}

/**
 * Check if an ERB comment content contains a herb:counter directive.
 */
export function isHerbCounterContent(content: string): boolean {
  return parseHerbCounterContent(content) !== null
}

/**
 * Check if a source line contains a herb:counter comment.
 */
export function isHerbCounterLine(line: string): boolean {
  return parseHerbCounterLine(line) !== null
}
