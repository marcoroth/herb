/**
 * Utilities for parsing herb:disable comments.
 *
 * Syntax:
 *   <%# herb:disable rule-name [, rule-name...] %>              # line-scoped
 *   <%# herb:disable rule-name <N> [, rule-name <N|all>...] %>  # file-scoped
 *
 * Each comma-separated entry is either:
 *   - `rule-name` alone -> line-scoped disable (existing behavior)
 *   - `rule-name N`     -> file-scoped counter (suppress N offenses)
 *   - `rule-name all`   -> file-scoped counter (suppress every offense)
 *
 * The two forms can be mixed in the same comment. Line-scoped entries are
 * surfaced through `ruleNames`/`ruleNameDetails` (so the existing meta-rules
 * that inspect them do not need to change); file-scoped entries are surfaced
 * through `fileScopedEntries` and consumed by the linter's suppression path.
 */

/**
 * Information about a single rule name in a herb:disable comment.
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
 * A file-scoped herb:disable entry (rule-name with a trailing count or `all`).
 */
export interface HerbDisableFileScopedEntry {
  /** The rule name */
  name: string
  /** Zero-based offset of the rule name within the content/line */
  nameOffset: number
  /** Length of the rule name */
  nameLength: number
  /** Suppression count. `"all"` means "suppress every offense of this rule". */
  count: number | "all"
  /** Zero-based offset of the count token within the content/line */
  countOffset: number
  /** Length of the count token as it appears in source */
  countLength: number
  /** The raw count token (e.g. `"3"` or `"all"`) */
  countRaw: string
}

/**
 * Result of parsing a herb:disable comment.
 */
export interface HerbDisableComment {
  /** The full matched string */
  match: string
  /** Line-scoped rule names (entries without a count/all suffix) */
  ruleNames: string[]
  /** Line-scoped rule name details with positions */
  ruleNameDetails: HerbDisableRuleName[]
  /** File-scoped counter entries (entries with a count or `all` suffix) */
  fileScopedEntries: HerbDisableFileScopedEntry[]
  /** The original rules string (e.g., "rule1, rule2 3, rule3 all") */
  rulesString: string
}

/**
 * Prefix for herb:disable comments
 */
const HERB_DISABLE_PREFIX = "herb:disable"

interface ParsedEntry {
  name: string
  nameOffset: number
  nameLength: number
  count?: number | "all"
  countOffset?: number
  countLength?: number
  countRaw?: string
}

function parseEntries(rulesString: string, rulesStringOffset: number): ParsedEntry[] | null {
  const rawEntries = rulesString.split(",")
  const entries: ParsedEntry[] = []

  let searchCursor = 0

  for (const rawEntry of rawEntries) {
    const entry = rawEntry.trim()
    if (entry.length === 0) return null

    // Find where this entry sits inside rulesString.
    const entryStart = rulesString.indexOf(entry, searchCursor)
    if (entryStart === -1) return null
    searchCursor = entryStart + entry.length

    const parts = entry.split(/\s+/)
    if (parts.length === 0 || parts.length > 2) return null

    const name = parts[0]
    if (name.length === 0) return null

    const nameOffset = rulesStringOffset + entryStart

    if (parts.length === 1) {
      entries.push({
        name,
        nameOffset,
        nameLength: name.length,
      })

      continue
    }

    const countRaw = parts[1]
    let count: number | "all"

    if (countRaw === "all") {
      count = "all"
    } else if (/^\d+$/.test(countRaw)) {
      const parsed = Number(countRaw)
      if (!Number.isFinite(parsed) || parsed < 0) return null
      count = parsed
    } else {
      return null
    }

    const countRelative = entry.indexOf(countRaw, name.length)
    if (countRelative === -1) return null
    const countOffset = rulesStringOffset + entryStart + countRelative

    entries.push({
      name,
      nameOffset,
      nameLength: name.length,
      count,
      countOffset,
      countLength: countRaw.length,
      countRaw,
    })
  }

  if (entries.length === 0) return null

  return entries
}

function buildResult(match: string, rulesString: string, entries: ParsedEntry[]): HerbDisableComment {
  const ruleNames: string[] = []
  const ruleNameDetails: HerbDisableRuleName[] = []
  const fileScopedEntries: HerbDisableFileScopedEntry[] = []

  for (const entry of entries) {
    if (entry.count === undefined) {
      ruleNames.push(entry.name)
      ruleNameDetails.push({
        name: entry.name,
        offset: entry.nameOffset,
        length: entry.nameLength,
      })
    } else {
      fileScopedEntries.push({
        name: entry.name,
        nameOffset: entry.nameOffset,
        nameLength: entry.nameLength,
        count: entry.count,
        countOffset: entry.countOffset!,
        countLength: entry.countLength!,
        countRaw: entry.countRaw!,
      })
    }
  }

  return {
    match,
    ruleNames,
    ruleNameDetails,
    fileScopedEntries,
    rulesString,
  }
}

/**
 * Parse a herb:disable comment from ERB comment content.
 * Use this when you have the content inside <%# ... %> (e.g., from ERBContentNode.content.value)
 *
 * @param content - The content string (without <%# %> delimiters)
 * @returns Parsed comment data or null if not a valid herb:disable comment
 */
export function parseHerbDisableContent(content: string): HerbDisableComment | null {
  const trimmed = content.trim()

  if (!trimmed.startsWith(HERB_DISABLE_PREFIX)) return null

  const afterPrefix = trimmed.substring(HERB_DISABLE_PREFIX.length).trimStart()
  if (afterPrefix.length === 0) return null

  const rulesString = afterPrefix.trimEnd()

  const herbDisablePrefix = content.indexOf(HERB_DISABLE_PREFIX)
  const searchStart = herbDisablePrefix + HERB_DISABLE_PREFIX.length
  const rulesStringOffset = content.indexOf(rulesString, searchStart)

  const entries = parseEntries(rulesString, rulesStringOffset)
  if (!entries) return null

  return buildResult(trimmed, rulesString, entries)
}

/**
 * Parse a herb:disable comment from a full source line.
 * Use this when you have a complete line that may contain <%# herb:disable ... %>
 *
 * @param line - The source line that may contain a herb:disable comment
 * @returns Parsed comment data or null if not a valid herb:disable comment
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

  const herbDisablePrefix = line.indexOf(HERB_DISABLE_PREFIX)
  const searchStart = herbDisablePrefix + HERB_DISABLE_PREFIX.length
  const rulesStringOffset = line.indexOf(rulesString, searchStart)

  const entries = parseEntries(rulesString, rulesStringOffset)
  if (!entries) return null

  const fullMatch = line.substring(startIndex, endIndex + endTag.length)

  return buildResult(fullMatch, rulesString, entries)
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
