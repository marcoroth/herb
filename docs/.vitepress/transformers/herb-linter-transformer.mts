import { rendererRich } from "@shikijs/twoslash"
import { transformerTwoslash } from "@shikijs/vitepress-twoslash"
import { createPositionConverter } from "twoslash-protocol"

import { Herb } from '@herb-tools/node'
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

// Create custom Twoslash function for linter diagnostics
function createCustomTwoslashFunction(_options) {
  return (code, lang, _options) => {
    let fileName = undefined

    // kind of a hack to make sure we pass a `fileName` for the `erb-require-trailing-newline` rule
    if (code.includes('▌')) {
      fileName = "erb-require-trailing-newline.html.erb"
    }

    if (!lang || !['erb', 'html'].includes(lang)) {
      return { code, nodes: [] }
    }

    let diagnostics
    try {
      const linter = new Linter(Herb)
      const result = linter.lint(code, { fileName })

      diagnostics = result.offenses.map(offense => {
        const startLine = offense.location?.start?.line || 1
        const startColumn = offense.location?.start?.column || 0
        const endLine = offense.location?.end?.line || startLine
        const endColumn = offense.location?.end?.column || startColumn + 1

        return {
          line: startLine,
          column: startColumn,
          endLine: endLine,
          endColumn: endColumn,
          message: offense.message,
          severity: offense.severity === 'error' ? 'error' : 'warning',
          rule: offense.rule
        }
      })
    } catch (error) {
      if (error.message && error.message.includes('backend is not loaded')) {
        console.log('Herb backend not loaded, skipping linter for:', lang)
      } else {
        console.error('❌ Linter error:', error)
      }
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
