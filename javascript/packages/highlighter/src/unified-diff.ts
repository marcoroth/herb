import type { DiffHunk } from "./diff-computer.js"

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/**
 * Parse unified diff text, as produced by `git diff` or `diff -u`, into hunks.
 *
 * Everything outside a hunk is ignored, so `diff --git` headers, index lines, mode changes and
 * commit message text all pass by harmlessly. A `\ No newline at end of file` marker is skipped
 * rather than treated as content.
 *
 * @param text - The unified diff
 * @returns One entry per file, in the order they appear, each with the file's hunks
 */
export function parseUnifiedDiff(text: string): { path: string, hunks: DiffHunk[] }[] {
  type ParsedFile = { path: string, hunks: DiffHunk[] }

  const files: ParsedFile[] = []

  let hunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  const current = (): ParsedFile | undefined => files[files.length - 1]

  const startFile = (path: string): ParsedFile => {
    const started: ParsedFile = { path, hunks: [] }

    files.push(started)
    hunk = null

    return started
  }

  for (const line of text.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim().replace(/^b\//, "")

      if (path !== "/dev/null") {
        const open = current()

        if (open && open.hunks.length === 0) {
          open.path = path
        } else {
          startFile(path)
        }
      }

      continue
    }

    if (line.startsWith("--- ") || line.startsWith("diff --git ")) {
      const open = current()

      if (!open || open.hunks.length > 0) startFile("")

      continue
    }

    const header = line.match(HUNK_HEADER)

    if (header) {
      const open = current() ?? startFile("")

      oldLine = parseInt(header[1], 10)
      newLine = parseInt(header[3], 10)
      hunk = { oldStart: oldLine, oldCount: 0, newStart: newLine, newCount: 0, lines: [] }

      open.hunks.push(hunk)

      continue
    }

    if (!hunk) continue
    if (line.startsWith("\\")) continue

    const marker = line[0]
    const content = line.slice(1)

    if (marker === " " || line === "") {
      hunk.lines.push({ type: "context", content, oldLineNumber: oldLine++, newLineNumber: newLine++ })
      hunk.oldCount++
      hunk.newCount++
    } else if (marker === "-") {
      hunk.lines.push({ type: "removed", content, oldLineNumber: oldLine++, newLineNumber: null })
      hunk.oldCount++
    } else if (marker === "+") {
      hunk.lines.push({ type: "added", content, oldLineNumber: null, newLineNumber: newLine++ })
      hunk.newCount++
    } else {
      hunk = null
    }
  }

  return files.filter(entry => entry.hunks.length > 0)
}
