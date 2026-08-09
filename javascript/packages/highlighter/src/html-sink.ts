import { readFileSync } from "fs"

import { DIAGNOSTIC_SEVERITIES } from "@herb-tools/core"
import { DEFAULT_THEME } from "./themes.js"
import { TextFormatter } from "./text-formatter.js"

import type { DiagnosticSeverity } from "@herb-tools/core"
import type {
  Annotation,
  CodeBlockNode,
  DiagnosticHeaderNode,
  DiffBlockNode,
  DiffHunkInfo,
  DiffRowInfo,
  Document,
  FileHeaderNode,
  InlineRangeInfo,
  LineInfo,
  ProgressRuleNode,
  StyledRun,
  StyleRole,
} from "./document.js"

export interface HTMLRenderOptions {
  focusLine?: number
  contextLines: number
  showLineNumbers: boolean
  themeLabel: string
}

export const DEFAULT_HTML_RENDER_OPTIONS: HTMLRenderOptions = {
  contextLines: 2,
  showLineNumbers: true,
  themeLabel: DEFAULT_THEME,
}

export type MarkerMode = "highlight-api" | "spans"

export interface HTMLSinkOptions {
  themeLabel: string
  showLineNumbers: boolean
  markers: MarkerMode
  diffLayout?: "unified" | "split"
}

export interface LinePiece {
  text: string
  role: StyleRole
}

export function escapeHTML(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function kebab(key: string): string {
  return key.toLowerCase().replaceAll("_", "-")
}

export function classForRole(role: StyleRole): string | null {
  switch (role.kind) {
    case "Plain":
      return null
    case "Token":
      return `herb-${kebab(role.tokenType)}`
    case "RubyKeyword":
      return "herb-ruby-keyword"
    case "TagName":
      return "herb-tag-name"
    case "AttributeName":
      return "herb-attr-name"
    case "AttributeValue":
      return "herb-attr-value"
    case "CommentInterior":
      return "herb-comment"
  }
}

export function splitRunsIntoLines(runs: StyledRun[]): LinePiece[][] {
  const lines: LinePiece[][] = [[]]

  for (const run of runs) {
    const pieces = run.text.split("\n")

    pieces.forEach((piece, index) => {
      if (index > 0) lines.push([])
      if (piece !== "") lines[lines.length - 1].push({ text: piece, role: run.role })
    })
  }

  return lines
}

function renderPiece(piece: LinePiece): string {
  const className = classForRole(piece.role)

  if (className === null) {
    return escapeHTML(piece.text)
  }

  return `<span class="${className}">${escapeHTML(piece.text)}</span>`
}

function renderLineContent(pieces: LinePiece[]): string {
  let content = ""

  for (const piece of pieces) {
    content += renderPiece(piece)
  }

  return content
}

function isLinkableUrl(url: string): boolean {
  const lower = url.toLowerCase()

  return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("file://")
}

function severityRank(severity: DiagnosticSeverity): number {
  return DIAGNOSTIC_SEVERITIES.indexOf(severity)
}

function formatMessageHTML(text: string): string {
  return TextFormatter.replaceBackticks(escapeHTML(text), "<code>", "</code>")
}

function formatCodeHTML(code: string | null, codeUrl: string | null): string {
  const text = code === null ? "-" : escapeHTML(code)

  if (codeUrl !== null && isLinkableUrl(codeUrl)) {
    return `<a href="${escapeHTML(codeUrl)}" rel="noopener noreferrer">${text}</a>`
  }

  return text
}

function severityAssignment(annotations: Annotation[], length: number): (DiagnosticSeverity | null)[] {
  const assignment: (DiagnosticSeverity | null)[] = new Array(length).fill(null)

  for (const annotation of annotations) {
    const start = Math.max(0, annotation.start)
    const end = Math.min(length, annotation.end)

    for (let column = start; column < end; column++) {
      const current = assignment[column]

      if (current === null || severityRank(annotation.severity) < severityRank(current)) {
        assignment[column] = annotation.severity
      }
    }
  }

  return assignment
}

function renderMarkedLineContent(pieces: LinePiece[], annotations: Annotation[]): string {
  const characters = pieces.map(piece => [...piece.text])
  const length = characters.reduce((total, piece) => total + piece.length, 0)
  const assignment = severityAssignment(annotations, length)

  let column = 0
  let content = ""

  pieces.forEach((piece, pieceIndex) => {
    const pieceCharacters = characters[pieceIndex]

    let index = 0

    while (index < pieceCharacters.length) {
      const severity = assignment[column + index]

      let end = index + 1

      while (end < pieceCharacters.length && assignment[column + end] === severity) {
        end++
      }

      const rendered = renderPiece({ text: pieceCharacters.slice(index, end).join(""), role: piece.role })

      content += severity === null ? rendered : `<mark class="herb-marker herb-marker-${severity}">${rendered}</mark>`

      index = end
    }

    column += pieceCharacters.length
  })

  return content
}

function renderAnnotationMessages(annotations: Annotation[]): string {
  let output = ""

  for (const annotation of annotations) {
    if (annotation.message === null) continue

    const message = annotation.message

    output += `<span class="herb-annotation-message"><span class="herb-severity-label herb-severity-${annotation.severity}">${annotation.severity}</span> ${formatMessageHTML(message.text)} <span class="herb-diagnostic-code">(${formatCodeHTML(message.code, message.codeUrl)})</span></span>`
  }

  return output
}

function renderAnnotatedLine(info: LineInfo, pieces: LinePiece[], options: HTMLSinkOptions): string {
  let className = "herb-line"

  if (info.emphasis.kind === "Marked") {
    className += " herb-line-marked"
  } else if (info.emphasis.kind === "Dimmed") {
    className += " herb-line-dimmed"
  }

  let attributes = ` class="${className}"`

  if (options.showLineNumbers) {
    attributes += ` data-line="${info.number}"`
  }

  if (info.emphasis.kind === "Marked") {
    attributes += ` data-herb-severity="${info.emphasis.severity}"`
  }

  if (options.markers === "highlight-api" && info.annotations.length > 0) {
    const markers = JSON.stringify(info.annotations.map(annotation => [annotation.start, annotation.end, annotation.severity]))

    attributes += ` data-herb-markers="${escapeHTML(markers)}"`
  }

  const content = options.markers === "spans" && info.annotations.length > 0
    ? renderMarkedLineContent(pieces, info.annotations)
    : renderLineContent(pieces)

  return `<span${attributes}>${content}${renderAnnotationMessages(info.annotations)}</span>`
}

function renderDiagnosticHeader(node: DiagnosticHeaderNode): string {
  const suffix = node.suffix === null ? "" : ` <span class="herb-diagnostic-suffix">${escapeHTML(node.suffix)}</span>`

  return `<header class="herb-diagnostic-header"><span class="herb-severity-label herb-severity-${node.severity}">${node.severity}</span> <span class="herb-diagnostic-message">${formatMessageHTML(node.message)}</span> <span class="herb-diagnostic-code">(${formatCodeHTML(node.code, node.codeUrl)})</span>${suffix}</header>`
}

function renderCard(header: DiagnosticHeaderNode, fileHeader: FileHeaderNode, block: CodeBlockNode, options: HTMLSinkOptions): string {
  const pieces = splitRunsIntoLines(block.runs)
  const lineSpans = block.lines.map(info => renderAnnotatedLine(info, pieces[info.number - block.firstLine] ?? [], options))

  let figcaption = ""

  if (options.showLineNumbers) {
    const location = `${escapeHTML(fileHeader.path)}:${fileHeader.line}:${fileHeader.column}`
    const linked = fileHeader.url !== null && isLinkableUrl(fileHeader.url)
      ? `<a href="${escapeHTML(fileHeader.url)}" rel="noopener noreferrer">${location}</a>`
      : location

    figcaption = `<figcaption class="herb-file-header">${linked}</figcaption>\n`
  }

  return `<figure class="herb-highlight herb-diagnostic" data-herb-theme="${escapeHTML(options.themeLabel)}">\n${renderDiagnosticHeader(header)}\n${figcaption}<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}

function renderInline(fileHeader: FileHeaderNode | null, block: CodeBlockNode, options: HTMLSinkOptions): string {
  const pieces = splitRunsIntoLines(block.runs)
  const lineSpans = block.lines.map(info => renderAnnotatedLine(info, pieces[info.number - block.firstLine] ?? [], options))

  const figcaption = fileHeader !== null && options.showLineNumbers
    ? `<figcaption class="herb-file-header">${escapeHTML(fileHeader.path)}</figcaption>\n`
    : ""

  return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(options.themeLabel)}">\n${figcaption}<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}

function renderListing(fileHeader: FileHeaderNode | null, block: CodeBlockNode, options: HTMLSinkOptions): string {
  const pieces = splitRunsIntoLines(block.runs)
  const contentFor = (info: LineInfo) => renderLineContent(pieces[info.number - block.firstLine] ?? [])

  if (fileHeader === null) {
    const lineSpans = block.lines.map(info => `<span class="herb-line">${contentFor(info)}</span>`)

    return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(options.themeLabel)}">\n<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
  }

  const hasFocus = block.lines.some(info => info.emphasis.kind === "Focus" || info.emphasis.kind === "Dimmed")

  if (!hasFocus && options.showLineNumbers) {
    const lineSpans = block.lines.map(info => `<span class="herb-line" data-line="${info.number}">${contentFor(info)}</span>`)

    return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(options.themeLabel)}">\n<figcaption class="herb-file-header">${escapeHTML(fileHeader.path)}</figcaption>\n<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
  }

  const lineSpans = block.lines.map(info => {
    const emphasisClass = info.emphasis.kind === "Focus"
      ? " herb-line-focus"
      : info.emphasis.kind === "Dimmed" ? " herb-line-dimmed" : ""
    const dataLine = options.showLineNumbers ? ` data-line="${info.number}"` : ""

    return `<span class="herb-line${emphasisClass}"${dataLine}>${contentFor(info)}</span>`
  })

  const figcaption = options.showLineNumbers ? `<figcaption class="herb-file-header">${escapeHTML(fileHeader.path)}</figcaption>\n` : ""

  return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(options.themeLabel)}">\n${figcaption}<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}

const HUNK_SEPARATOR_ROW = `<span class="herb-line herb-diff-hunk-separator"></span>`
const EMPTY_DIFF_CELL = `<span class="herb-line herb-diff-empty"></span>`

function rangeAssignment(ranges: InlineRangeInfo[], length: number): boolean[] {
  const assignment: boolean[] = new Array(length).fill(false)

  for (const range of ranges) {
    const start = Math.max(0, range.start)
    const end = Math.min(length, range.end)

    for (let column = start; column < end; column++) {
      assignment[column] = true
    }
  }

  return assignment
}

function renderInlineMarkedContent(pieces: LinePiece[], ranges: InlineRangeInfo[], markClass: string): string {
  const characters = pieces.map(piece => [...piece.text])
  const length = characters.reduce((total, piece) => total + piece.length, 0)
  const assignment = rangeAssignment(ranges, length)

  let column = 0
  let content = ""

  pieces.forEach((piece, pieceIndex) => {
    const pieceCharacters = characters[pieceIndex]

    let index = 0

    while (index < pieceCharacters.length) {
      const inRange = assignment[column + index]

      let end = index + 1

      while (end < pieceCharacters.length && assignment[column + end] === inRange) {
        end++
      }

      const rendered = renderPiece({ text: pieceCharacters.slice(index, end).join(""), role: piece.role })

      content += inRange ? `<mark class="${markClass}">${rendered}</mark>` : rendered

      index = end
    }

    column += pieceCharacters.length
  })

  return content
}

function diffRowContent(row: DiffRowInfo, originalPieces: LinePiece[][], modifiedPieces: LinePiece[][]): string {
  const pieces = row.kind === "added"
    ? modifiedPieces[row.newLine! - 1] ?? []
    : originalPieces[row.oldLine! - 1] ?? []

  if (row.inlineRanges.length === 0) return renderLineContent(pieces)

  const markClass = row.kind === "removed" ? "herb-diff-inline-removed" : "herb-diff-inline-added"

  return renderInlineMarkedContent(pieces, row.inlineRanges, markClass)
}

function renderDiffRow(row: DiffRowInfo, content: string, showLineNumbers: boolean): string {
  if (row.kind === "context") {
    const attributes = showLineNumbers ? ` data-old-line="${row.oldLine}" data-new-line="${row.newLine}"` : ""

    return `<span class="herb-line herb-diff-context"${attributes}>${content}</span>`
  }

  if (row.kind === "removed") {
    const attributes = showLineNumbers ? ` data-old-line="${row.oldLine}"` : ""

    return `<span class="herb-line herb-diff-removed"${attributes}>${content}</span>`
  }

  const attributes = showLineNumbers ? ` data-new-line="${row.newLine}"` : ""

  return `<span class="herb-line herb-diff-added"${attributes}>${content}</span>`
}

function pairDiffRows(hunk: DiffHunkInfo): { left: DiffRowInfo | null, right: DiffRowInfo | null }[] {
  const rows: { left: DiffRowInfo | null, right: DiffRowInfo | null }[] = []

  let index = 0

  while (index < hunk.rows.length) {
    const row = hunk.rows[index]

    if (row.kind === "context") {
      rows.push({ left: row, right: row })
      index++

      continue
    }

    const removed: DiffRowInfo[] = []

    while (index < hunk.rows.length && hunk.rows[index].kind === "removed") {
      removed.push(hunk.rows[index])
      index++
    }

    const added: DiffRowInfo[] = []

    while (index < hunk.rows.length && hunk.rows[index].kind === "added") {
      added.push(hunk.rows[index])
      index++
    }

    for (let pair = 0; pair < Math.max(removed.length, added.length); pair++) {
      rows.push({ left: removed[pair] ?? null, right: added[pair] ?? null })
    }
  }

  return rows
}

function renderSplitDiff(
  figcaption: string,
  block: DiffBlockNode,
  originalPieces: LinePiece[][],
  modifiedPieces: LinePiece[][],
  options: HTMLSinkOptions,
): string {
  const left: string[] = []
  const right: string[] = []

  const cellFor = (row: DiffRowInfo | null): string => row === null
    ? EMPTY_DIFF_CELL
    : renderDiffRow(row, diffRowContent(row, originalPieces, modifiedPieces), options.showLineNumbers)

  block.hunks.forEach((hunk, hunkIndex) => {
    if (hunkIndex > 0) {
      left.push(HUNK_SEPARATOR_ROW)
      right.push(HUNK_SEPARATOR_ROW)
    }

    for (const { left: leftRow, right: rightRow } of pairDiffRows(hunk)) {
      left.push(cellFor(leftRow))
      right.push(cellFor(rightRow))
    }
  })

  return `<figure class="herb-highlight herb-diff herb-diff-split" data-herb-theme="${escapeHTML(options.themeLabel)}">\n${figcaption}<div class="herb-diff-columns">\n<pre class="herb-code herb-diff-column herb-diff-column-old"><code>${left.join("\n")}</code></pre>\n<pre class="herb-code herb-diff-column herb-diff-column-new"><code>${right.join("\n")}</code></pre>\n</div>\n</figure>`
}

function renderDiff(fileHeader: FileHeaderNode | null, block: DiffBlockNode, options: HTMLSinkOptions): string {
  const originalPieces = splitRunsIntoLines(block.originalRuns)
  const modifiedPieces = splitRunsIntoLines(block.modifiedRuns)

  const figcaption = fileHeader !== null && options.showLineNumbers
    ? `<figcaption class="herb-file-header">${escapeHTML(fileHeader.path)}</figcaption>\n`
    : ""

  if ((options.diffLayout ?? "unified") === "split") {
    return renderSplitDiff(figcaption, block, originalPieces, modifiedPieces, options)
  }

  const rows: string[] = []

  block.hunks.forEach((hunk, hunkIndex) => {
    if (hunkIndex > 0) rows.push(HUNK_SEPARATOR_ROW)

    for (const row of hunk.rows) {
      rows.push(renderDiffRow(row, diffRowContent(row, originalPieces, modifiedPieces), options.showLineNumbers))
    }
  })

  return `<figure class="herb-highlight herb-diff" data-herb-theme="${escapeHTML(options.themeLabel)}">\n${figcaption}<pre class="herb-code"><code>${rows.join("\n")}</code></pre>\n</figure>`
}

function renderProgressRule(node: ProgressRuleNode): string {
  return `<hr class="herb-progress-rule" data-herb-progress="${node.index}/${node.total}">`
}

export function renderDocumentFragments(document: Document, options: HTMLSinkOptions): string[] {
  const fragments: string[] = []
  const nodes = document.nodes

  let i = 0

  while (i < nodes.length) {
    const node = nodes[i]

    if (node.type === "DiagnosticHeader") {
      fragments.push(renderCard(node, nodes[i + 1] as FileHeaderNode, nodes[i + 2] as CodeBlockNode, options))
      i += 3
    } else if (node.type === "FileHeader" && nodes[i + 1]?.type === "DiffBlock") {
      fragments.push(renderDiff(node, nodes[i + 1] as DiffBlockNode, options))
      i += 2
    } else if (node.type === "FileHeader") {
      const block = nodes[i + 1] as CodeBlockNode

      fragments.push(block.kind === "AnnotatedListing" ? renderInline(node, block, options) : renderListing(node, block, options))
      i += 2
    } else if (node.type === "DiffBlock") {
      fragments.push(renderDiff(null, node, options))
      i += 1
    } else if (node.type === "CodeBlock") {
      fragments.push(node.kind === "AnnotatedListing" ? renderInline(null, node, options) : renderListing(null, node, options))
      i += 1
    } else {
      fragments.push(renderProgressRule(node))
      i += 1
    }
  }

  return fragments
}

export function renderDocumentHTML(document: Document, options: HTMLSinkOptions): string {
  return renderDocumentFragments(document, options).join("\n")
}

export function wrapDocumentHTML(fragments: string, stylesheet: string, includeHydration: boolean): string {
  const script = includeHydration
    ? `<script>\n${readFileSync(new URL("../assets/herb-markers.js", import.meta.url), "utf-8")}</script>\n`
    : ""

  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>herb-highlight</title>\n<style>\n${stylesheet}</style>\n</head>\n<body>\n${fragments}\n${script}</body>\n</html>`
}

function normalLines(count: number): LineInfo[] {
  const lines: LineInfo[] = []

  for (let i = 1; i <= count; i++) {
    lines.push({ number: i, emphasis: { kind: "Normal" }, annotations: [] })
  }

  return lines
}

export function renderFileHTML(runs: StyledRun[], path: string, themeLabel: string): string {
  const document: Document = {
    version: 1,
    nodes: [
      { type: "FileHeader", path, line: null, column: null, url: null },
      { type: "CodeBlock", kind: "Listing", firstLine: 1, runs, lines: normalLines(splitRunsIntoLines(runs).length) },
    ],
  }

  return renderDocumentHTML(document, { themeLabel, showLineNumbers: true, markers: "spans" })
}

export function renderPlainHTML(runs: StyledRun[], themeLabel: string): string {
  const document: Document = {
    version: 1,
    nodes: [
      { type: "CodeBlock", kind: "Listing", firstLine: 1, runs, lines: normalLines(splitRunsIntoLines(runs).length) },
    ],
  }

  return renderDocumentHTML(document, { themeLabel, showLineNumbers: false, markers: "spans" })
}

export function renderFocusHTML(
  runs: StyledRun[],
  path: string,
  focusLine: number,
  contextLines: number,
  showLineNumbers: boolean,
  themeLabel: string,
): string {
  const lineCount = splitRunsIntoLines(runs).length
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

  const document: Document = {
    version: 1,
    nodes: [
      { type: "FileHeader", path, line: null, column: null, url: null },
      { type: "CodeBlock", kind: "Listing", firstLine: 1, runs, lines },
    ],
  }

  return renderDocumentHTML(document, { themeLabel, showLineNumbers, markers: "spans" })
}
