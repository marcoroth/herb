import type { SerializedLocation } from "@herb-tools/core"

/**
 * A single `~~~` underline for one line of a (possibly multi-line) diagnostic.
 *
 * `start` and `end` are zero-based indices into the source line, `end` being exclusive.
 */
export interface DiagnosticMarker {
  line: number
  start: number
  end: number
}

/**
 * Compute the underline markers for a diagnostic location.
 *
 * A diagnostic spanning multiple lines gets one marker per line: the first line is
 * marked from `location.start.column`, the last line up to `location.end.column`, and
 * every line in between is marked across its non-whitespace content. Lines without any
 * content to mark (blank or whitespace-only) are skipped.
 *
 * @param location - The diagnostic location
 * @param lines - The source content split into lines
 * @returns One marker per marked line, ordered from first to last, never empty
 */
export function computeDiagnosticMarkers(location: SerializedLocation, lines: string[]): DiagnosticMarker[] {
  const startLine = Math.max(1, location.start.line)
  const endLine = Math.max(startLine, Math.min(location.end.line, Math.max(lines.length, startLine)))

  const markers: DiagnosticMarker[] = []

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
    const line = lines[lineNumber - 1] ?? ""
    const isFirstLine = lineNumber === startLine
    const isLastLine = lineNumber === location.end.line

    const start = Math.max(0, isFirstLine ? location.start.column : line.length - line.trimStart().length)
    const end = isLastLine ? location.end.column : line.trimEnd().length

    if (end > start) {
      markers.push({ line: lineNumber, start, end })
    }
  }

  if (markers.length === 0) {
    const start = Math.max(0, location.start.column)

    markers.push({ line: startLine, start, end: start + 1 })
  }

  return markers
}
