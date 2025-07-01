import { readFileSync } from 'fs'
import { SyntaxRenderer } from './syntax-renderer.js'
import { DiagnosticRenderer } from './diagnostic-renderer.js'
import { FileRenderer } from './file-renderer.js'
import { themes } from './themes.js'
import { colorize } from './color.js'

import type { HerbBackend, Diagnostic } from '@herb-tools/core'
import type { Theme } from './themes.js'

export interface HighlightOptions {
  diagnostics?: Diagnostic[]
  splitDiagnostics?: boolean

  contextLines?: number
  focusLine?: number
  showLineNumbers?: boolean
}

export interface HighlightDiagnosticOptions {
  contextLines?: number
  showLineNumbers?: boolean
  optimizeHighlighting?: boolean
}

export class Highlighter {
  private syntaxRenderer: SyntaxRenderer
  private diagnosticRenderer: DiagnosticRenderer
  private fileRenderer: FileRenderer

  constructor(theme: Theme = 'default', herb?: HerbBackend) {
    const colors = themes[theme]
    this.syntaxRenderer = new SyntaxRenderer(colors, herb)
    this.diagnosticRenderer = new DiagnosticRenderer(this.syntaxRenderer)
    this.fileRenderer = new FileRenderer(this.syntaxRenderer)
  }

  /**
   * Initialize the highlighter with the Herb backend
   * This must be called before using highlight() or highlightDiagnostic()
   */
  async initialize(): Promise<void> {
    await this.syntaxRenderer.initialize()
  }

  /**
   * Check if the highlighter has been initialized
   */
  get initialized(): boolean {
    return this.syntaxRenderer.initialized
  }

  /**
   * Main highlighting method with flexible rendering options
   * @param path - File path for annotation (display only, not used for reading)
   * @param content - The content to highlight
   * @param options - Configuration options
   *   - diagnostics: Array of diagnostics to display inline or split
   *   - splitDiagnostics: When true with diagnostics, render each diagnostic individually
   *   - contextLines: Number of context lines around focus/diagnostics
   *   - focusLine: Line number to focus on (shows only that line with dimmed context)
   *   - showLineNumbers: Whether to show line numbers (default: true)
   * @returns The highlighted content with optional diagnostics or focused view
   */
  highlight(path: string, content: string, options: HighlightOptions = {}): string {
    if (!this.syntaxRenderer.initialized) {
      throw new Error('Highlighter must be initialized before use. Call await highlighter.initialize() first.')
    }

    const {
      diagnostics = [],
      splitDiagnostics = false,
      contextLines = 0,
      focusLine,
      showLineNumbers = true
    } = options

    // Case 1: Split diagnostics - render each diagnostic individually
    if (diagnostics.length > 0 && splitDiagnostics) {
      const results: string[] = []
      for (const diagnostic of diagnostics) {
        const result = this.highlightDiagnostic(path, diagnostic, content, { contextLines, showLineNumbers })
        results.push(result)
      }
      return results.join('\n')
    }

    // Case 2: Inline diagnostics - show whole file with diagnostics inline
    if (diagnostics.length > 0) {
      return this.renderInlineDiagnostics(path, content, diagnostics, contextLines, showLineNumbers)
    }

    // Case 3: Focus line - show only specific line with context
    if (focusLine) {
      return this.fileRenderer.renderWithFocusLine(path, content, focusLine, contextLines, showLineNumbers)
    }

    // Case 4: Default - just highlight the whole file
    if (showLineNumbers) {
      return this.fileRenderer.renderWithLineNumbers(path, content)
    } else {
      return this.fileRenderer.renderPlain(content)
    }
  }

  /**
   * Render a single diagnostic with context lines and syntax highlighting
   * @param path - The file path to display in the diagnostic (display only)
   * @param diagnostic - The diagnostic message to render
   * @param content - The content to highlight and render
   * @param options - Optional configuration
   * @returns The rendered diagnostic output with syntax highlighting
   */
  highlightDiagnostic(
    path: string,
    diagnostic: Diagnostic,
    content: string,
    options: HighlightDiagnosticOptions = {}
  ): string {
    if (!this.syntaxRenderer.initialized) {
      throw new Error('Highlighter must be initialized before use. Call await highlighter.initialize() first.')
    }

    return this.diagnosticRenderer.renderSingle(path, diagnostic, content, options)
  }

  private applyDimToStyledText(text: string): string {
    const isColorEnabled = process.env.NO_COLOR === undefined
    if (!isColorEnabled) return text

    return text.replace(/\x1b\[([0-9;]*)m/g, (match, codes) => {
      if (codes === '0' || codes === '') {
        return match
      }

      return `\x1b[2;${codes}m`
    })
  }

  private highlightBackticks(text: string): string {
    if (process.stdout.isTTY && process.env.NO_COLOR === undefined) {
      const boldWhite = '\x1b[1m\x1b[37m'
      const reset = '\x1b[0m'
      return text.replace(/`([^`]+)`/g, `${boldWhite}$1${reset}`)
    }
    return text
  }

  private renderInlineDiagnostics(path: string, content: string, diagnostics: Diagnostic[], _contextLines: number, showLineNumbers = true): string {
    const highlightedContent = this.syntaxRenderer.highlight(content)

    const messagesByLine = new Map<number, Diagnostic[]>()
    for (const diagnostic of diagnostics) {
      const lineNumber = diagnostic.location.start.line
      if (!messagesByLine.has(lineNumber)) {
        messagesByLine.set(lineNumber, [])
      }
      messagesByLine.get(lineNumber)!.push(diagnostic)
    }

    for (const lineMessages of messagesByLine.values()) {
      lineMessages.sort((a, b) => {
        if (a.severity === 'error' && b.severity === 'warning') return -1
        if (a.severity === 'warning' && b.severity === 'error') return 1

        return 0
      })
    }

    const lines = highlightedContent.split('\n')
    let output = showLineNumbers ? `${colorize(path, "cyan")}\n\n` : ''

    for (let i = 1; i <= lines.length; i++) {
      const line = lines[i - 1] || ''
      const lineMessages = messagesByLine.get(i) || []
      const hasMessages = lineMessages.length > 0

      const hasErrors = lineMessages.some(msg => msg.severity === 'error')

      let displayLine = line

      if (showLineNumbers) {
        const lineNumber = hasMessages ?
          colorize(i.toString().padStart(3, ' '), "bold") :
          colorize(i.toString().padStart(3, ' '), "gray")

        const prefix = hasMessages ?
          colorize('  → ', hasErrors ? "brightRed" : "brightYellow") :
          '    '

        const separator = colorize('│', "gray")

        output += `${prefix}${lineNumber} ${separator} ${displayLine}\n`
      } else {
        output += `${displayLine}\n`
      }

      if (hasMessages) {
        for (const diagnostic of lineMessages) {
          const column = diagnostic.location.start.column - 1
          const pointerLength = Math.max(1, diagnostic.location.end.column - diagnostic.location.start.column)
          const isError = diagnostic.severity === 'error'

          if (showLineNumbers) {
            const pointerPrefix = `        ${colorize('│', "gray")}`
            const pointerSpacing = ' '.repeat(column + 2)
            const pointer = colorize('~'.repeat(pointerLength), isError ? "brightRed" : "brightYellow")

            output += `${pointerPrefix}${pointerSpacing}${pointer}\n`

            const severityText = isError ? colorize("error", "brightRed") : colorize("warning", "brightYellow")
            const diagnosticId = colorize(diagnostic.id, "gray")
            const highlightedMessage = this.highlightBackticks(diagnostic.message)
            const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`
            const dimmedDiagnosticText = this.applyDimToStyledText(diagnosticText)

            output += `${pointerPrefix}${pointerSpacing}${dimmedDiagnosticText}\n`
          } else {
            const pointerSpacing = ' '.repeat(column)
            const pointer = colorize('~'.repeat(pointerLength), isError ? "brightRed" : "brightYellow")

            output += `${pointerSpacing}${pointer}\n`

            const severityText = isError ? colorize("error", "brightRed") : colorize("warning", "brightYellow")
            const diagnosticId = colorize(diagnostic.id, "gray")
            const highlightedMessage = this.highlightBackticks(diagnostic.message)
            const diagnosticText = `[${severityText}] ${highlightedMessage} (${diagnosticId})`
            const dimmedDiagnosticText = this.applyDimToStyledText(diagnosticText)

            output += `${dimmedDiagnosticText}\n`
          }
        }
        output += '\n'
      }
    }

    return output.trimEnd()
  }

  // File reading wrapper functions

  /**
   * Convenience method that reads a file and highlights it
   * @param filePath - Path to the file to read and highlight
   * @param options - Configuration options
   * @returns The highlighted file content with optional diagnostics
   */
  highlightFileFromPath(filePath: string, options: HighlightOptions = {}): string {
    if (!this.syntaxRenderer.initialized) {
      throw new Error('Highlighter must be initialized before use. Call await highlighter.initialize() first.')
    }

    try {
      const content = readFileSync(filePath, 'utf8')
      return this.highlight(filePath, content, options)
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Convenience method that reads a file and renders a diagnostic
   * @param filePath - Path to the file to read
   * @param diagnostic - The diagnostic message to render
   * @param options - Optional configuration
   * @returns The highlighted diagnostic output
   */
  highlightDiagnosticFromPath(
    filePath: string,
    diagnostic: Diagnostic,
    options: HighlightDiagnosticOptions = {}
  ): string {
    if (!this.syntaxRenderer.initialized) {
      throw new Error('Highlighter must be initialized before use. Call await highlighter.initialize() first.')
    }

    try {
      const content = readFileSync(filePath, 'utf8')
      return this.highlightDiagnostic(filePath, diagnostic, content, options)
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
