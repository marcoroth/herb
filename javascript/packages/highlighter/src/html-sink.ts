import { DEFAULT_THEME } from "./themes.js"

import type { StyledRun, StyleRole } from "./document.js"

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

function renderLineContent(pieces: LinePiece[]): string {
  let content = ""

  for (const piece of pieces) {
    const className = classForRole(piece.role)

    if (className === null) {
      content += escapeHTML(piece.text)
    } else {
      content += `<span class="${className}">${escapeHTML(piece.text)}</span>`
    }
  }

  return content
}

export function renderFileHTML(runs: StyledRun[], path: string, themeLabel: string): string {
  const lines = splitRunsIntoLines(runs)
  const lineSpans = lines.map((pieces, index) => `<span class="herb-line" data-line="${index + 1}">${renderLineContent(pieces)}</span>`)

  return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(themeLabel)}">\n<figcaption class="herb-file-header">${escapeHTML(path)}</figcaption>\n<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}

export function renderPlainHTML(runs: StyledRun[], themeLabel: string): string {
  const lines = splitRunsIntoLines(runs)
  const lineSpans = lines.map(pieces => `<span class="herb-line">${renderLineContent(pieces)}</span>`)

  return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(themeLabel)}">\n<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}

export function renderFocusHTML(
  runs: StyledRun[],
  path: string,
  focusLine: number,
  contextLines: number,
  showLineNumbers: boolean,
  themeLabel: string,
): string {
  const lines = splitRunsIntoLines(runs)
  const startLine = Math.max(1, focusLine - contextLines)
  const endLine = Math.min(lines.length, focusLine + contextLines)

  const lineSpans: string[] = []

  for (let line = startLine; line <= endLine; line++) {
    const className = line === focusLine ? "herb-line herb-line-focus" : "herb-line herb-line-dimmed"
    const dataLine = showLineNumbers ? ` data-line="${line}"` : ""

    lineSpans.push(`<span class="${className}"${dataLine}>${renderLineContent(lines[line - 1])}</span>`)
  }

  const header = showLineNumbers ? `<figcaption class="herb-file-header">${escapeHTML(path)}</figcaption>\n` : ""

  return `<figure class="herb-highlight" data-herb-theme="${escapeHTML(themeLabel)}">\n${header}<pre class="herb-code"><code>${lineSpans.join("\n")}</code></pre>\n</figure>`
}
