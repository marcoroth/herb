import { DIAGNOSTIC_SEVERITIES } from "@herb-tools/core"
import { computeDiagnosticMarkers } from "./diagnostic-markers.js"
import { computeDiffHunks, computeInlineRanges } from "./diff-computer.js"

import type { Diagnostic, DiagnosticSeverity } from "@herb-tools/core"
import type { DiffHunk, DiffLine, InlineRange } from "./diff-computer.js"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type {
  Annotation,
  CollapseInfo,
  DiffHunkInfo,
  DiffRowInfo,
  Document,
  FileHeaderNode,
  LineInfo,
  Node,
  StyledRun,
} from "./document.js"

export interface CardOptions {
  contextLines: number
  optimizeHighlighting: boolean
  codeUrl: string | null
  fileUrl: string | null
  suffix: string | null
}

export interface DiffDocumentOptions {
  contextLines: number
  highlightInlineChanges: boolean
}

export interface SplitOptions {
  contextLines: number
  codeUrlBuilder?: (code: string) => string
  fileUrlBuilder?: (path: string, diagnostic: Diagnostic) => string
  suffixBuilder?: (diagnostic: Diagnostic) => string | undefined
}

const severityOrder: Record<DiagnosticSeverity, number> = {
  "error": 0,
  "warning": 1,
  "info": 2,
  "hint": 3
}

const highestSeverity = (annotations: Annotation[]): DiagnosticSeverity => {
  for (const severity of DIAGNOSTIC_SEVERITIES) {
    if (annotations.some(annotation => annotation.severity === severity)) {
      return severity
    }
  }

  return "warning"
}

const fileHeader = (path: string): FileHeaderNode => ({
  type: "FileHeader",
  path,
  line: null,
  column: null,
  url: null,
})

export class DocumentBuilder {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  buildFile(path: string, content: string): Document {
    return {
      version: 1,
      nodes: [fileHeader(path), this.listing(content)],
    }
  }

  buildPlain(content: string): Document {
    return {
      version: 1,
      nodes: [this.listing(content)],
    }
  }

  buildFocus(path: string, content: string, focusLine: number, contextLines: number): Document {
    const lineCount = content.split("\n").length

    const startLine = Math.max(1, focusLine - contextLines)
    const endLine = Math.min(lineCount, focusLine + contextLines)

    const lines: LineInfo[] = []

    for (let i = startLine; i <= endLine; i++) {
      lines.push({
        number: i,
        emphasis: i === focusLine ? { kind: "Focus" } : { kind: "Dimmed" },
        annotations: [],
      })
    }

    return {
      version: 1,
      nodes: [
        fileHeader(path),
        {
          type: "CodeBlock",
          kind: "Listing",
          firstLine: 1,
          runs: this.syntaxRenderer.highlightRuns(content),
          lines,
        },
      ],
    }
  }

  buildInline(
    path: string,
    content: string,
    diagnostics: Diagnostic[],
    codeUrlBuilder?: (code: string) => string,
  ): Document {
    const contentLines = content.split("\n")

    const annotationsByLine = new Map<number, Annotation[]>()

    for (const diagnostic of diagnostics) {
      const markers = computeDiagnosticMarkers(diagnostic.location, contentLines)

      markers.forEach((marker, index) => {
        if (!annotationsByLine.has(marker.line)) {
          annotationsByLine.set(marker.line, [])
        }

        const isLastLine = index === markers.length - 1

        annotationsByLine.get(marker.line)!.push({
          start: marker.start,
          end: marker.end,
          severity: diagnostic.severity,
          message: isLastLine
            ? {
                text: diagnostic.message,
                code: diagnostic.code ?? null,
                codeUrl: codeUrlBuilder && diagnostic.code ? codeUrlBuilder(diagnostic.code) : null,
              }
            : null,
        })
      })
    }

    for (const annotations of annotationsByLine.values()) {
      annotations.sort((a, b) => {
        const orderA = severityOrder[a.severity] ?? 99
        const orderB = severityOrder[b.severity] ?? 99
        return orderA - orderB
      })
    }

    const lines: LineInfo[] = []

    for (let i = 1; i <= contentLines.length; i++) {
      const annotations = annotationsByLine.get(i) ?? []

      lines.push({
        number: i,
        emphasis: annotations.length > 0
          ? { kind: "Marked", severity: highestSeverity(annotations) }
          : { kind: "Normal" },
        annotations,
      })
    }

    return {
      version: 1,
      nodes: [
        fileHeader(path),
        {
          type: "CodeBlock",
          kind: "AnnotatedListing",
          firstLine: 1,
          runs: this.syntaxRenderer.highlightRuns(content),
          lines,
        },
      ],
    }
  }

  buildCard(path: string, diagnostic: Diagnostic, content: string, options: CardOptions): Document {
    const { contextLines, optimizeHighlighting, codeUrl, fileUrl, suffix } = options

    const originalLines = content.split("\n")

    const markers = computeDiagnosticMarkers(diagnostic.location, originalLines)
    const markersByLine = new Map(markers.map(marker => [marker.line, marker]))

    const firstMarkedLine = markers[0].line
    const lastMarkedLine = markers[markers.length - 1].line

    const startLine = Math.max(1, firstMarkedLine - contextLines)
    const endLine = Math.min(originalLines.length, lastMarkedLine + contextLines)

    let runs: StyledRun[]
    let firstLine: number

    if (optimizeHighlighting) {
      const relevantLines = []

      for (let i = startLine; i <= endLine; i++) {
        relevantLines.push(originalLines[i - 1] || "")
      }

      runs = this.syntaxRenderer.highlightRuns(relevantLines.join("\n"))
      firstLine = startLine
    } else {
      runs = this.syntaxRenderer.highlightRuns(content)
      firstLine = 1
    }

    const lines: LineInfo[] = []

    for (let i = startLine; i <= endLine; i++) {
      const marker = markersByLine.get(i)

      if (marker) {
        lines.push({
          number: i,
          emphasis: { kind: "Marked", severity: diagnostic.severity },
          annotations: [{ start: marker.start, end: marker.end, severity: diagnostic.severity, message: null }],
        })
      } else {
        lines.push({ number: i, emphasis: { kind: "Dimmed" }, annotations: [] })
      }
    }

    return {
      version: 1,
      nodes: [
        {
          type: "DiagnosticHeader",
          severity: diagnostic.severity,
          message: diagnostic.message,
          code: diagnostic.code ?? null,
          codeUrl,
          suffix,
        },
        {
          type: "FileHeader",
          path,
          line: diagnostic.location.start.line,
          column: diagnostic.location.start.column,
          url: fileUrl,
        },
        { type: "CodeBlock", kind: "Excerpt", firstLine, runs, lines },
      ],
    }
  }

  buildSplit(path: string, content: string, diagnostics: Diagnostic[], options: SplitOptions): Document {
    const { contextLines, codeUrlBuilder, fileUrlBuilder, suffixBuilder } = options

    const nodes: Node[] = []

    for (let i = 0; i < diagnostics.length; i++) {
      const diagnostic = diagnostics[i]
      const codeUrl = codeUrlBuilder && diagnostic.code ? codeUrlBuilder(diagnostic.code) : undefined
      const fileUrl = fileUrlBuilder ? fileUrlBuilder(path, diagnostic) : undefined
      const suffix = suffixBuilder ? suffixBuilder(diagnostic) : undefined

      const card = this.buildCard(path, diagnostic, content, {
        contextLines,
        optimizeHighlighting: true,
        codeUrl: codeUrl ?? null,
        fileUrl: fileUrl ?? null,
        suffix: suffix ?? null,
      })

      nodes.push(...card.nodes)

      if (i < diagnostics.length - 1) {
        nodes.push({ type: "ProgressRule", index: i + 1, total: diagnostics.length })
      }
    }

    return { version: 1, nodes }
  }

  buildDiff(path: string, original: string, modified: string, options: Partial<DiffDocumentOptions> = {}): Document {
    const { contextLines = 2, highlightInlineChanges = true } = options

    const hunks = computeDiffHunks(original, modified, contextLines)

    if (hunks.length === 0) return { version: 1, nodes: [] }

    return this.diffDocument(
      path,
      hunks,
      this.syntaxRenderer.highlightRuns(original),
      this.syntaxRenderer.highlightRuns(modified),
      highlightInlineChanges,
    )
  }

  buildDiffFromHunks(path: string, hunks: DiffHunk[], options: Partial<DiffDocumentOptions> = {}): Document {
    const { highlightInlineChanges = true } = options

    if (hunks.length === 0) return { version: 1, nodes: [] }

    const originalLines: string[] = []
    const modifiedLines: string[] = []

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.oldLineNumber !== null) originalLines[line.oldLineNumber - 1] = line.content
        if (line.newLineNumber !== null) modifiedLines[line.newLineNumber - 1] = line.content
      }
    }

    const runs = (lines: string[]) => {
      const filled = Array.from(lines, line => line ?? "")

      return this.syntaxRenderer.highlightRuns(filled.join("\n"))
    }

    return this.diffDocument(path, hunks, runs(originalLines), runs(modifiedLines), highlightInlineChanges)
  }

  private diffDocument(
    path: string,
    hunks: DiffHunk[],
    originalRuns: StyledRun[],
    modifiedRuns: StyledRun[],
    highlightInlineChanges: boolean,
  ): Document {
    const nodes: Node[] = []

    if (path !== "") nodes.push(fileHeader(path))

    nodes.push({
      type: "DiffBlock",
      originalRuns,
      modifiedRuns,
      hunks: hunks.map(hunk => this.diffHunkInfo(hunk, highlightInlineChanges)),
    })

    return { version: 1, nodes }
  }

  private diffHunkInfo(hunk: DiffHunk, highlightInlineChanges: boolean): DiffHunkInfo {
    const inlineRanges = highlightInlineChanges ? this.inlineRangesFor(hunk) : new Map<DiffLine, InlineRange[]>()
    const collapses = this.collapseCandidatesFor(hunk, inlineRanges)

    const rows: DiffRowInfo[] = hunk.lines.map(line => ({
      kind: line.type,
      content: line.content,
      oldLine: line.oldLineNumber,
      newLine: line.newLineNumber,
      inlineRanges: (inlineRanges.get(line) ?? []).map(range => ({ start: range.start, end: range.end })),
      collapse: collapses.get(line) ?? null,
    }))

    return { rows }
  }

  private inlineRangesFor(hunk: DiffHunk): Map<DiffLine, InlineRange[]> {
    const ranges = new Map<DiffLine, InlineRange[]>()

    let index = 0

    while (index < hunk.lines.length) {
      if (hunk.lines[index].type !== "removed") {
        index++
        continue
      }

      const removed: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "removed") {
        removed.push(hunk.lines[index])
        index++
      }

      const added: DiffLine[] = []

      while (index < hunk.lines.length && hunk.lines[index].type === "added") {
        added.push(hunk.lines[index])
        index++
      }

      if (removed.length !== added.length) continue

      for (let pair = 0; pair < removed.length; pair++) {
        const { removed: removedRanges, added: addedRanges } = computeInlineRanges(removed[pair].content, added[pair].content)

        if (removedRanges.length > 0 || addedRanges.length > 0) {
          ranges.set(removed[pair], removedRanges)
          ranges.set(added[pair], addedRanges)
        }
      }
    }

    return ranges
  }

  private collapseCandidatesFor(hunk: DiffHunk, inlineRanges: Map<DiffLine, InlineRange[]>): Map<DiffLine, CollapseInfo> {
    const candidates = new Map<DiffLine, CollapseInfo>()

    for (let index = 0; index < hunk.lines.length - 1; index++) {
      const removed = hunk.lines[index]
      const added = hunk.lines[index + 1]

      if (removed.type !== "removed" || added.type !== "added") continue
      if (hunk.lines[index + 2]?.type === "added") continue
      if (index > 0 && hunk.lines[index - 1].type === "removed") continue

      const removedRanges = inlineRanges.get(removed)
      const addedRanges = inlineRanges.get(added)

      if (!removedRanges || !addedRanges) continue
      if (removedRanges.length > 1 || addedRanges.length > 1) continue
      if (removedRanges.length === 0 && addedRanges.length === 0) continue

      const start = Math.min(removedRanges[0]?.start ?? Infinity, addedRanges[0]?.start ?? Infinity)

      candidates.set(removed, {
        start,
        removedEnd: removedRanges[0]?.end ?? start,
        addedEnd: addedRanges[0]?.end ?? start,
      })

      index++
    }

    return candidates
  }

  private listing(content: string): Node {
    const lineCount = content.split("\n").length

    const lines: LineInfo[] = []

    for (let i = 1; i <= lineCount; i++) {
      lines.push({ number: i, emphasis: { kind: "Normal" }, annotations: [] })
    }

    return {
      type: "CodeBlock",
      kind: "Listing",
      firstLine: 1,
      runs: this.syntaxRenderer.highlightRuns(content),
      lines,
    }
  }
}
