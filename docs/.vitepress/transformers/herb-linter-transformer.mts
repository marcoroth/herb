import { rendererRich } from "@shikijs/twoslash"
import { transformerTwoslash } from "@shikijs/vitepress-twoslash"
import { createPositionConverter } from "twoslash-protocol"

import { Herb } from '@herb-tools/node-wasm'
import { Linter } from '@herb-tools/linter'

export interface LinterDiagnostic {
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  severity: 'error' | 'warning' | 'info'
  rule?: string
}

function runLinterOnCodeSync(code: string, language: string, third: any): LinterDiagnostic[] {
  console.log('runLinterOnCodeSync called with:', { language, code })

  const supportedLanguages = ['erb', 'html', 'html+erb', 'html.erb', 'herb']

  if (!supportedLanguages.includes(language)) {
    console.log('Skipping linter - not erb/html language, got:', language)
    return []
  }

  if (typeof Herb.parse !== 'function') {
    console.log('Herb.parse not available, skipping linter')
    return []
  }

  try {
    console.log('Running linter on code:', code.substring(0, 100))
    const linter = new Linter()
    const document = Herb.parse(code)
    const result = linter.lint(document.value)

    console.log('Linter result:', { offenses: result.offenses.length, errors: result.errors, warnings: result.warnings })
    console.log('First offense structure:', result.offenses[0])

    const diagnostics = result.offenses.map(offense => {
      const startLine = offense.location?.start?.line || 1
      const startColumn = offense.location?.start?.column || 0
      const endLine = offense.location?.end?.line || startLine
      const endColumn = offense.location?.end?.column || startColumn + 1

      console.log('Raw offense location:', {
        rule: offense.rule,
        start: offense.location?.start,
        end: offense.location?.end,
        mapped: { startLine, startColumn, endLine, endColumn }
      })

      return {
        line: startLine,        // 1-based line (matches linter output)
        column: startColumn,    // 0-based column (matches linter output)
        endLine: endLine,       // 1-based line
        endColumn: endColumn,   // 0-based column
        message: offense.message,
        severity: offense.severity === 'error' ? 'error' : 'warning',
        rule: offense.rule
      }
    })

    console.log('Mapped diagnostics:', diagnostics)
    return diagnostics
  } catch (error) {
    // If parsing fails, return empty diagnostics
    console.warn('Failed to run linter on code snippet:', error)
    return []
  }
}

// Create custom Twoslash function for linter diagnostics
function createCustomTwoslashFunction() {
  return (code, lang, options) => {
    console.log("MEEEEEE:", options)

    // Check meta.__raw directly (since the flag might not be preserved)
    if (options?.meta?.__raw?.includes('no-herb-lint')) {
      return { code, nodes: [] }
    }

    if (lang?.includes('no-herb-lint')) {
      return { code, nodes: [] }
    }

    if (!lang || !['erb', 'html'].includes(lang)) {
      return { code, nodes: [] }
    }

    let diagnostics
    try {
      diagnostics = runLinterOnCodeSync(code, lang)
    } catch (error) {
      console.error('❌ Linter error:', error)
      return { code, nodes: [] }
    }

    if (!diagnostics || diagnostics.length === 0) {
      return { code, nodes: [] }
    }

    let converter

    try {
      converter = createPositionConverter(code)
    } catch (error) {
      console.error('❌ Position converter error:', error)
      return { code, nodes: [] }
    }

    const twoslashNodes = []

    diagnostics.forEach((diagnostic, index) => {
      try {
        // Convert line/column to character index
        // Linter gives us: 1-based lines, 0-based columns
        // posToIndex expects: 0-based lines, 0-based columns
        const startIndex = converter.posToIndex(diagnostic.line - 1, diagnostic.column)

        const endIndex = converter.posToIndex(
          (diagnostic.endLine || diagnostic.line) - 1,
          diagnostic.endColumn || diagnostic.column + 1
        )

        const errorNode = {
          type: 'error',
          level: diagnostic.severity === 'warning' ? 'warning' : 'error',
          code: diagnostic.rule,
          text: `${diagnostic.message} (${diagnostic.rule})`,
          start: startIndex,
          length: Math.max(1, endIndex - startIndex),
          line: diagnostic.line - 1,
          character: diagnostic.column,
          id: `linter-error-${index}`
        }

        twoslashNodes.push(errorNode)
      } catch (error) {
        console.error('❌ Error creating node for diagnostic:', diagnostic, error)
      }
    })

    return {
      code,
      nodes: twoslashNodes,
      customTags: ["no-herb-lint"],
      meta: {
        extension: lang === 'erb' ? 'erb' : 'html'
      }
    }
  }
}

// Herb Linter Twoslash transformer
export const herbLinterTransformer = transformerTwoslash({
  renderer: rendererRich({
    errorRendering: 'line' // 'line' | 'hover'
  }),
  twoslasher: createCustomTwoslashFunction(),
  twoslashOptions: {
    handbookOptions: {
      noErrorValidation: true
    }
  },
  // Only apply to ERB/HTML languages
  langs: ['erb', 'html', 'html+erb', 'html.erb', 'herb'],
  langAlias: {
    "html+erb": "erb",
    "html.erb": "erb",
    "herb": "erb",
  },
  explicitTrigger: false, // Don't require 'twoslash' in code block
  throws: true, // Don't throw on errors
  onTwoslashError: (error, code, lang) => {
    console.warn('Twoslash error:', error, 'for lang:', lang)
    return code // Return original code on error
  }
})
