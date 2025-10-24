/**
 * Utilities for parsing herb:disable comments
 */

/**
 * Information about a single rule name in a herb:disable comment
 */
export interface HerbDisableRuleName {
  /** The rule name */
  name: string
  /** The starting offset of this rule name within the content/line */
  offset: number
  /** The length of the rule name */
  length: number
}

/**
 * Result of parsing a herb:disable comment
 */
export interface HerbDisableComment {
  /** The full matched string */
  match: string
  /** Array of rule names specified in the comment */
  ruleNames: string[]
  /** Array of rule name information with positions */
  ruleNameDetails: HerbDisableRuleName[]
  /** The original rules string (e.g., "rule1, rule2") */
  rulesString: string
}

/**
 * Regex pattern for matching herb:disable comments in ERB comment content.
 * Matches: herb:disable rule1, rule2, ...
 * Note: This pattern is for use with ERBContentNode.content.value (the content inside <%# ... %>)
 */
export const HERB_DISABLE_CONTENT_REGEX = /^\s*herb:disable\s+([a-zA-Z0-9_-]+(?:\s*,\s*[a-zA-Z0-9_-]+)*)\s*$/

/**
 * Regex pattern for matching herb:disable comments in a full source line.
 * Matches: <%# herb:disable rule1, rule2, ... %>
 * Note: This pattern includes the ERB comment delimiters and can match anywhere in a line
 */
export const HERB_DISABLE_LINE_REGEX = /<%#\s*herb:disable\s*([a-zA-Z0-9_-]+(?:\s*,\s*[a-zA-Z0-9_-]+)*)\s*%>/

/**
 * Parse a herb:disable comment from ERB comment content.
 * Use this when you have the content inside <%# ... %> (e.g., from ERBContentNode.content.value)
 *
 * @param content - The content string (without <%# %> delimiters)
 * @returns Parsed comment data or null if not a valid herb:disable comment
 *
 * @example
 * ```ts
 * const result = parseHerbDisableContent("herb:disable rule1, rule2")
 * // { match: "herb:disable rule1, rule2", ruleNames: ["rule1", "rule2"], rulesString: "rule1, rule2" }
 * ```
 */
export function parseHerbDisableContent(content: string): HerbDisableComment | null {
  const match = content.match(HERB_DISABLE_CONTENT_REGEX)
  if (!match) return null

  const rulesString = match[1]
  const ruleNames = rulesString.split(/\s*,\s*/)

  const herbDisablePrefix = content.indexOf("herb:disable")
  const searchStart = herbDisablePrefix + "herb:disable".length
  const rulesStringOffset = content.indexOf(rulesString, searchStart)

  const ruleNameDetails: HerbDisableRuleName[] = []

  let currentOffset = 0

  for (const ruleName of ruleNames) {
    const ruleOffset = rulesString.indexOf(ruleName, currentOffset)

    ruleNameDetails.push({
      name: ruleName,
      offset: rulesStringOffset + ruleOffset,
      length: ruleName.length
    })

    currentOffset = ruleOffset + ruleName.length
  }

  return {
    match: match[0],
    ruleNames,
    ruleNameDetails,
    rulesString
  }
}

/**
 * Parse a herb:disable comment from a full source line.
 * Use this when you have a complete line that may contain <%# herb:disable ... %>
 *
 * @param line - The source line that may contain a herb:disable comment
 * @returns Parsed comment data or null if not a valid herb:disable comment
 *
 * @example
 * ```ts
 * const result = parseHerbDisableLine("<div>test</div> <%# herb:disable rule1, rule2 %>")
 * // { match: "<%# herb:disable rule1, rule2 %>", ruleNames: ["rule1", "rule2"], rulesString: "rule1, rule2" }
 * ```
 */
export function parseHerbDisableLine(line: string): HerbDisableComment | null {
  const match = line.match(HERB_DISABLE_LINE_REGEX)
  if (!match) return null

  const rulesString = match[1]
  const ruleNames = rulesString.split(/\s*,\s*/)

  const herbDisablePrefix = line.indexOf("herb:disable")
  const searchStart = herbDisablePrefix + "herb:disable".length
  const rulesStringOffset = line.indexOf(rulesString, searchStart)

  const ruleNameDetails: HerbDisableRuleName[] = []

  let currentOffset = 0

  for (const ruleName of ruleNames) {
    const ruleOffset = rulesString.indexOf(ruleName, currentOffset)

    ruleNameDetails.push({
      name: ruleName,
      offset: rulesStringOffset + ruleOffset,
      length: ruleName.length
    })

    currentOffset = ruleOffset + ruleName.length
  }

  return {
    match: match[0],
    ruleNames,
    ruleNameDetails,
    rulesString
  }
}

/**
 * Check if an ERB comment content contains a herb:disable directive.
 *
 * @param content - The content string (without <%# %> delimiters)
 * @returns true if the content contains a herb:disable directive
 */
export function isHerbDisableContent(content: string): boolean {
  return HERB_DISABLE_CONTENT_REGEX.test(content)
}

/**
 * Check if a source line contains a herb:disable comment.
 *
 * @param line - The source line
 * @returns true if the line contains a herb:disable comment
 */
export function isHerbDisableLine(line: string): boolean {
  return HERB_DISABLE_LINE_REGEX.test(line)
}
