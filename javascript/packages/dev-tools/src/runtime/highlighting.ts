import { Location } from '@herb-tools/core'
import { DiagnosticRenderer, DiffRenderer, FileRenderer, HerbANSIElement, InlineDiagnosticRenderer, SyntaxRenderer } from '@herb-tools/highlighter'

import { resolveTheme } from '@herb-tools/highlighter'

import type { Diagnostic } from '@herb-tools/core'
import type { NormalizedDiagnostic, NormalizedFix } from './report.js'

export const HIGHLIGHTER_THEME = 'onedark'
export const CONTEXT_LINES = 2
export const FOCUSED_CONTEXT_LINES = 6
export const DIFF_CONTEXT_LINES = 1
export const MAX_WIDTH = 120

const BLOCK_SEPARATOR = '\n\n'

export interface ExcerptOptions {
  fileUrl?: string
  contextLines?: number
}

export interface RuntimeHighlighting {
  excerpt(source: string, diagnostic: NormalizedDiagnostic, options?: ExcerptOptions): string | null
  diff(path: string, source: string, fix: NormalizedFix): string | null
  file(source: string): string | null
}

let setup: Promise<RuntimeHighlighting | null> | null = null

export function resetRuntimeHighlighting() {
  setup = null
}

export function loadRuntimeHighlighting(): Promise<RuntimeHighlighting | null> {
  if (setup === null) {
    setup = build().catch((error) => {
      console.warn('[HerbDevTools] Syntax highlighting unavailable:', error)

      return null
    })
  }

  return setup
}

async function build(): Promise<RuntimeHighlighting> {
  const { Herb } = await import('@herb-tools/browser')
  const colors = resolveTheme(HIGHLIGHTER_THEME)
  const syntaxRenderer = new SyntaxRenderer(colors, Herb)

  await syntaxRenderer.initialize()

  HerbANSIElement.define()

  const diagnosticRenderer = new DiagnosticRenderer(syntaxRenderer)
  const fileRenderer = new FileRenderer(syntaxRenderer)
  const diffRenderer = new DiffRenderer(syntaxRenderer, colors)
  const inlineRenderer = new InlineDiagnosticRenderer(syntaxRenderer)

  return {
    excerpt(source, diagnostic, options = {}) {
      if (diagnostic.location === null) {
        return null
      }

      const { fileUrl } = options
      const contextLines = options.contextLines ?? CONTEXT_LINES

      try {
        if (diagnostic.severity === null) {
          const focusLine = clampLine(diagnostic.location.start.line, source)

          return dropLeadingBlocks(
            fileRenderer.renderWithFocusLine(diagnostic.template, source, focusLine, contextLines, true, MAX_WIDTH, false, false, fileUrl),
            1,
          )
        }

        return dropLeadingBlocks(
          diagnosticRenderer.renderSingle(diagnostic.template, toDiagnostic(diagnostic, source), source, {
            contextLines,
            showLineNumbers: true,
            wrapLines: false,
            truncateLines: false,
            maxWidth: MAX_WIDTH,
            ...(fileUrl === undefined ? {} : { fileUrl }),
          }),
          2,
        )
      } catch (_error) {
        return null
      }
    },

    file(source) {
      try {
        return syntaxRenderer.highlight(source)
      } catch (_error) {
        return null
      }
    },

    diff(path, source, fix) {
      try {
        const rendered = diffRenderer.render(path, source, fix.source, {
          contextLines: DIFF_CONTEXT_LINES,
          layout: 'unified',
          showLineNumbers: true,
          wrapLines: false,
          truncateLines: false,
          maxWidth: MAX_WIDTH,
        })

        const body = dropLeadingBlocks(rendered, 1)

        return body === null || body.trim().length === 0 ? null : body
      } catch (_error) {
        return null
      }
    },
  }
}

function toDiagnostic(diagnostic: NormalizedDiagnostic, source: string): Diagnostic {
  const range = diagnostic.location!
  const end = range.end ?? range.start

  return {
    message: diagnostic.message,
    severity: diagnostic.severity!,
    location: Location.from({
      start: { line: clampLine(range.start.line, source), column: toOffset(range.start.column) },
      end: { line: clampLine(end.line, source), column: toOffset(end.column) },
    }),
    ...(diagnostic.code === null ? {} : { code: diagnostic.code }),
  }
}

function toOffset(column: number): number {
  return Math.max(0, column - 1)
}

function clampLine(line: number, source: string): number {
  return Math.max(1, Math.min(line, source.split('\n').length))
}

export function dropLeadingBlocks(rendered: string, blocks: number): string | null {
  if (rendered.trim().length === 0) {
    return null
  }

  const parts = rendered.split(BLOCK_SEPARATOR)

  if (parts.length <= blocks) {
    return rendered
  }

  return parts.slice(blocks).join(BLOCK_SEPARATOR)
}
