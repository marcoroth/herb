import { colorize } from "@herb-tools/highlighter"

export interface DiffLine {
  type: "context" | "removed" | "added"
  content: string
  lineNumber: number
}

export interface DiffHunk {
  lines: DiffLine[]
}

export function computeDiff(original: string, fixed: string, contextLines: number = 1): DiffHunk[] {
  if (original === fixed) return []

  const originalLines = original.split("\n")
  const fixedLines = fixed.split("\n")

  if (originalLines.length === fixedLines.length) {
    return computeParallelDiff(originalLines, fixedLines, contextLines)
  }

  return computeBlockDiff(originalLines, fixedLines, contextLines)
}

function computeParallelDiff(originalLines: string[], fixedLines: string[], contextLines: number): DiffHunk[] {
  const changeIndices: number[] = []

  for (let index = 0; index < originalLines.length; index++) {
    if (originalLines[index] !== fixedLines[index]) {
      changeIndices.push(index)
    }
  }

  if (changeIndices.length === 0) return []

  const changeGroups: number[][] = []
  let currentGroup: number[] = [changeIndices[0]]

  for (let index = 1; index < changeIndices.length; index++) {
    const gapBetweenChanges = changeIndices[index] - changeIndices[index - 1] - 1

    if (gapBetweenChanges <= contextLines * 2) {
      currentGroup.push(changeIndices[index])
    } else {
      changeGroups.push(currentGroup)
      currentGroup = [changeIndices[index]]
    }
  }

  changeGroups.push(currentGroup)

  const hunks: DiffHunk[] = []

  for (const group of changeGroups) {
    const hunk: DiffHunk = { lines: [] }
    const firstChange = group[0]
    const lastChange = group[group.length - 1]
    const contextStart = Math.max(0, firstChange - contextLines)
    const contextEnd = Math.min(originalLines.length - 1, lastChange + contextLines)

    for (let index = contextStart; index <= contextEnd; index++) {
      if (group.includes(index)) {
        hunk.lines.push({ type: "removed", content: originalLines[index], lineNumber: index + 1 })
        hunk.lines.push({ type: "added", content: fixedLines[index], lineNumber: index + 1 })
      } else {
        hunk.lines.push({ type: "context", content: originalLines[index], lineNumber: index + 1 })
      }
    }

    hunks.push(hunk)
  }

  return hunks
}

function computeBlockDiff(originalLines: string[], fixedLines: string[], contextLines: number): DiffHunk[] {
  let prefixLength = 0

  while (
    prefixLength < originalLines.length &&
    prefixLength < fixedLines.length &&
    originalLines[prefixLength] === fixedLines[prefixLength]
  ) {
    prefixLength++
  }

  let originalEnd = originalLines.length - 1
  let fixedEnd = fixedLines.length - 1

  while (
    originalEnd > prefixLength &&
    fixedEnd > prefixLength &&
    originalLines[originalEnd] === fixedLines[fixedEnd]
  ) {
    originalEnd--
    fixedEnd--
  }

  if (prefixLength > originalEnd && prefixLength > fixedEnd) {
    return []
  }

  const hunk: DiffHunk = { lines: [] }

  const contextStart = Math.max(0, prefixLength - contextLines)

  for (let index = contextStart; index < prefixLength; index++) {
    hunk.lines.push({ type: "context", content: originalLines[index], lineNumber: index + 1 })
  }

  for (let index = prefixLength; index <= originalEnd; index++) {
    hunk.lines.push({ type: "removed", content: originalLines[index], lineNumber: index + 1 })
  }

  for (let index = prefixLength; index <= fixedEnd; index++) {
    hunk.lines.push({ type: "added", content: fixedLines[index], lineNumber: index + 1 })
  }

  const contextEnd = Math.min(originalLines.length - 1, originalEnd + contextLines)

  for (let index = originalEnd + 1; index <= contextEnd; index++) {
    hunk.lines.push({ type: "context", content: originalLines[index], lineNumber: index + 1 })
  }

  return hunk.lines.length > 0 ? [hunk] : []
}

export function formatDiff(hunks: DiffHunk[], indent: string = "    "): string {
  const lines: string[] = []

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]

    if (hunkIndex > 0) {
      lines.push(indent + colorize("  ...", "gray"))
    }

    for (const line of hunk.lines) {
      switch (line.type) {
        case "removed":
          lines.push(indent + colorize(`- ${line.content}`, "red"))
          break

        case "added":
          lines.push(indent + colorize(`+ ${line.content}`, "green"))
          break

        case "context":
          lines.push(indent + colorize(`  ${line.content}`, "gray"))
          break
      }
    }
  }

  return lines.join("\n")
}
