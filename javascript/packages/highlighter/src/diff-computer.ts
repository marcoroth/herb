export type DiffLineType = "context" | "added" | "removed"

/**
 * A single line of a rendered diff.
 *
 * `oldLineNumber` is set for context and removed lines, `newLineNumber` for context
 * and added lines. Both are one-based.
 */
export interface DiffLine {
  type: DiffLineType
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

/**
 * A contiguous run of changed lines together with the context lines around it.
 */
export interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

/**
 * Line counts above which the quadratic LCS is skipped in favour of trimming the
 * common prefix and suffix. Autofix previews are far below this.
 */
const MAX_LCS_LINES = 2000

/**
 * Line length above which intra-line refinement is skipped.
 */
const MAX_INLINE_REFINE_LENGTH = 500

/**
 * Unchanged characters between two changed spans below which the spans are merged, so a
 * single edit does not render as scattered fragments.
 */
const INLINE_SPAN_MERGE_GAP = 3

/**
 * A character range within a line, as `[start, end)` indices into the plain text.
 */
export interface InlineRange {
  start: number
  end: number
}

type Operation = { type: DiffLineType; oldIndex: number; newIndex: number }

function commonPrefixLength(original: string[], modified: string[]): number {
  let length = 0

  while (length < original.length && length < modified.length && original[length] === modified[length]) {
    length++
  }

  return length
}

function commonSuffixLength(original: string[], modified: string[], prefixLength: number): number {
  let length = 0

  while (
    length < original.length - prefixLength &&
    length < modified.length - prefixLength &&
    original[original.length - 1 - length] === modified[modified.length - 1 - length]
  ) {
    length++
  }

  return length
}

/**
 * Longest common subsequence over lines, returned as the operations that turn
 * `original` into `modified`.
 */
function lcsOperations(original: string[], modified: string[]): Operation[] {
  const rows = original.length
  const columns = modified.length

  const lengths: number[][] = Array.from({ length: rows + 1 }, () => new Array(columns + 1).fill(0))

  for (let row = rows - 1; row >= 0; row--) {
    for (let column = columns - 1; column >= 0; column--) {
      lengths[row][column] = original[row] === modified[column]
        ? lengths[row + 1][column + 1] + 1
        : Math.max(lengths[row + 1][column], lengths[row][column + 1])
    }
  }

  const operations: Operation[] = []

  let row = 0
  let column = 0

  while (row < rows && column < columns) {
    if (original[row] === modified[column]) {
      operations.push({ type: "context", oldIndex: row, newIndex: column })
      row++
      column++
    } else if (lengths[row + 1][column] >= lengths[row][column + 1]) {
      operations.push({ type: "removed", oldIndex: row, newIndex: -1 })
      row++
    } else {
      operations.push({ type: "added", oldIndex: -1, newIndex: column })
      column++
    }
  }

  while (row < rows) {
    operations.push({ type: "removed", oldIndex: row, newIndex: -1 })
    row++
  }

  while (column < columns) {
    operations.push({ type: "added", oldIndex: -1, newIndex: column })
    column++
  }

  return operations
}

/**
 * Diff without the quadratic table: keep the common prefix and suffix as context and
 * treat everything between them as one replaced block.
 */
function trimmedOperations(original: string[], modified: string[]): Operation[] {
  const prefixLength = commonPrefixLength(original, modified)
  const suffixLength = commonSuffixLength(original, modified, prefixLength)

  const operations: Operation[] = []

  for (let index = 0; index < prefixLength; index++) {
    operations.push({ type: "context", oldIndex: index, newIndex: index })
  }

  for (let index = prefixLength; index < original.length - suffixLength; index++) {
    operations.push({ type: "removed", oldIndex: index, newIndex: -1 })
  }

  for (let index = prefixLength; index < modified.length - suffixLength; index++) {
    operations.push({ type: "added", oldIndex: -1, newIndex: index })
  }

  for (let index = 0; index < suffixLength; index++) {
    operations.push({
      type: "context",
      oldIndex: original.length - suffixLength + index,
      newIndex: modified.length - suffixLength + index,
    })
  }

  return operations
}

/**
 * Compute the hunks that turn `original` into `modified`.
 *
 * Unchanged regions larger than `contextLines` on either side of a change are dropped,
 * splitting the diff into separate hunks.
 *
 * @param original - The source before the change
 * @param modified - The source after the change
 * @param contextLines - Unchanged lines to keep around each change (default: 2)
 * @returns The hunks, empty when both sources are identical
 */
export function computeDiffHunks(original: string, modified: string, contextLines = 2): DiffHunk[] {
  if (original === modified) return []

  const originalLines = original.split("\n")
  const modifiedLines = modified.split("\n")

  const useLcs = originalLines.length <= MAX_LCS_LINES && modifiedLines.length <= MAX_LCS_LINES
  const operations = useLcs
    ? lcsOperations(originalLines, modifiedLines)
    : trimmedOperations(originalLines, modifiedLines)

  const changedIndices = operations.flatMap((operation, index) => operation.type === "context" ? [] : [index])

  if (changedIndices.length === 0) return []

  const groups: number[][] = [[changedIndices[0]]]

  for (let index = 1; index < changedIndices.length; index++) {
    const gap = changedIndices[index] - changedIndices[index - 1] - 1

    if (gap <= contextLines * 2) {
      groups[groups.length - 1].push(changedIndices[index])
    } else {
      groups.push([changedIndices[index]])
    }
  }

  return groups.map(group => {
    const first = Math.max(0, group[0] - contextLines)
    const last = Math.min(operations.length - 1, group[group.length - 1] + contextLines)

    const lines: DiffLine[] = []

    let oldStart = 0
    let newStart = 0
    let oldCount = 0
    let newCount = 0

    for (let index = first; index <= last; index++) {
      const operation = operations[index]

      const oldLineNumber = operation.oldIndex >= 0 ? operation.oldIndex + 1 : null
      const newLineNumber = operation.newIndex >= 0 ? operation.newIndex + 1 : null

      if (oldLineNumber !== null) {
        oldStart = oldStart || oldLineNumber
        oldCount++
      }

      if (newLineNumber !== null) {
        newStart = newStart || newLineNumber
        newCount++
      }

      lines.push({
        type: operation.type,
        content: operation.type === "added" ? modifiedLines[operation.newIndex] : originalLines[operation.oldIndex],
        oldLineNumber,
        newLineNumber,
      })
    }

    return { oldStart, oldCount, newStart, newCount, lines }
  })
}

function mergeRanges(indices: number[]): InlineRange[] {
  if (indices.length === 0) return []

  const ranges: InlineRange[] = [{ start: indices[0], end: indices[0] + 1 }]

  for (const index of indices.slice(1)) {
    const last = ranges[ranges.length - 1]

    if (index - last.end <= INLINE_SPAN_MERGE_GAP) {
      last.end = index + 1
    } else {
      ranges.push({ start: index, end: index + 1 })
    }
  }

  return ranges
}

/**
 * Compute which characters differ between two versions of a single line.
 *
 * Returns the ranges to highlight on each side. Both are empty when the lines share too
 * little to make a character-level comparison meaningful, in which case the caller should
 * fall back to marking the whole line.
 *
 * @param before - The line before the change
 * @param after - The line after the change
 * @returns Ranges into `before` and into `after`
 */
export function computeInlineRanges(before: string, after: string): { removed: InlineRange[], added: InlineRange[] } {
  const empty = { removed: [], added: [] }

  if (before === after) return empty
  if (before.length > MAX_INLINE_REFINE_LENGTH || after.length > MAX_INLINE_REFINE_LENGTH) return empty

  const operations = lcsOperations([...before], [...after])

  const sharedLength = operations.filter(operation => operation.type === "context").length
  const longestLength = Math.max(before.length, after.length)

  if (sharedLength === 0 || sharedLength * 4 < longestLength) return empty

  const removedIndices = operations.flatMap(operation => operation.type === "removed" ? [operation.oldIndex] : [])
  const addedIndices = operations.flatMap(operation => operation.type === "added" ? [operation.newIndex] : [])

  return { removed: mergeRanges(removedIndices), added: mergeRanges(addedIndices) }
}
