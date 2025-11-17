/**
 * Utilities for parsing herb:disable comments
 */

import { isERBCommentNode } from "@herb-tools/core"
import type { Node } from "@herb-tools/core"

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
 * Prefix for herb:disable comments
 */
const HERB_DISABLE_PREFIX = "herb:disable"

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
  const trimmed = content.trim()

  if (!trimmed.startsWith(HERB_DISABLE_PREFIX)) return null

  const afterPrefix = trimmed.substring(HERB_DISABLE_PREFIX.length).trimStart()
  if (afterPrefix.length === 0) return null

  const rulesString = afterPrefix.trimEnd()
  const ruleNames = rulesString.split(',').map(name => name.trim())

  if (ruleNames.some(name => name.length === 0)) return null
  if (ruleNames.length === 0) return null

  const herbDisablePrefix = content.indexOf(HERB_DISABLE_PREFIX)
  const searchStart = herbDisablePrefix + HERB_DISABLE_PREFIX.length
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
    match: trimmed,
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
  const startTag = "<%#"
  const endTag = "%>"

  const startIndex = line.indexOf(startTag)
  if (startIndex === -1) return null

  const endIndex = line.indexOf(endTag, startIndex)
  if (endIndex === -1) return null

  const content = line.substring(startIndex + startTag.length, endIndex).trim()

  if (!content.startsWith(HERB_DISABLE_PREFIX)) return null

  const afterPrefix = content.substring(HERB_DISABLE_PREFIX.length).trimStart()
  if (afterPrefix.length === 0) return null

  const rulesString = afterPrefix.trimEnd()
  const ruleNames = rulesString.split(',').map(name => name.trim())

  if (ruleNames.some(name => name.length === 0)) return null
  if (ruleNames.length === 0) return null

  const herbDisablePrefix = line.indexOf(HERB_DISABLE_PREFIX)
  const searchStart = herbDisablePrefix + HERB_DISABLE_PREFIX.length
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

  const fullMatch = line.substring(startIndex, endIndex + endTag.length)

  return {
    match: fullMatch,
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
  return parseHerbDisableContent(content) !== null
}

/**
 * Check if a source line contains a herb:disable comment.
 *
 * @param line - The source line
 * @returns true if the line contains a herb:disable comment
 */
export function isHerbDisableLine(line: string): boolean {
  return parseHerbDisableLine(line) !== null
}
