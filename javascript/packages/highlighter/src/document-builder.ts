import { DIAGNOSTIC_SEVERITIES } from "@herb-tools/core"
import { computeDiagnosticMarkers } from "./diagnostic-markers.js"

import type { Diagnostic, DiagnosticSeverity } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { Annotation, Document, FileHeaderNode, LineInfo, Node, StyledRun } from "./document.js"

export interface CardOptions {
  contextLines: number
  optimizeHighlighting: boolean
  codeUrl: string | null
  fileUrl: string | null
  suffix: string | null
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
