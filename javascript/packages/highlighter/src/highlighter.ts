import { SyntaxRenderer } from "./syntax-renderer.js"
import { DiagnosticRenderer } from "./diagnostic-renderer.js"
import { FileRenderer } from "./file-renderer.js"
import { InitializationManager } from "./initialization-manager.js"
import { InlineDiagnosticRenderer } from "./inline-diagnostic-renderer.js"
import { FileReader } from "./file-reader.js"
import { LineWrapper } from "./line-wrapper.js"
import { resolveTheme } from "./themes.js"

import type { HerbBackend, Diagnostic } from "@herb-tools/core"
import type { ThemeInput } from "./themes.js"

export interface HighlightOptions {
  diagnostics?: Diagnostic[]
  splitDiagnostics?: boolean

  contextLines?: number
  focusLine?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
}

export interface HighlightDiagnosticOptions {
  contextLines?: number
  showLineNumbers?: boolean
  optimizeHighlighting?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
}

export class Highlighter {
  private syntaxRenderer: SyntaxRenderer
  private diagnosticRenderer: DiagnosticRenderer
  private fileRenderer: FileRenderer
  private initManager: InitializationManager
  private inlineDiagnosticRenderer: InlineDiagnosticRenderer
  private fileReader: FileReader

  constructor(theme: ThemeInput = "onedark", herb?: HerbBackend) {
    const colors = resolveTheme(theme)
    this.syntaxRenderer = new SyntaxRenderer(colors, herb)
    this.diagnosticRenderer = new DiagnosticRenderer(this.syntaxRenderer)
    this.fileRenderer = new FileRenderer(this.syntaxRenderer)
    this.initManager = new InitializationManager(herb)
    this.inlineDiagnosticRenderer = new InlineDiagnosticRenderer(this.syntaxRenderer)
    this.fileReader = new FileReader(this)
  }

  /**
   * Initialize the highlighter with the Herb backend
   * This must be called before using highlight() or highlightDiagnostic()
   */
  async initialize(): Promise<void> {
    await this.initManager.initialize()
    await this.syntaxRenderer.initialize()
  }

  /**
   * Check if the highlighter has been initialized
   */
  get initialized(): boolean {
    return this.initManager.initialized
  }

  requireInitialized(): void {
    this.initManager.requireInitialized()
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
  highlight(
    path: string,
    content: string,
    options: HighlightOptions = {},
  ): string {
    this.requireInitialized()

    const {
      diagnostics = [],
      splitDiagnostics = false,
      contextLines = 0,
      focusLine,
      showLineNumbers = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
    } = options

    // Case 1: Split diagnostics - render each diagnostic individually
    if (diagnostics.length > 0 && splitDiagnostics) {
      const results: string[] = []
      for (let i = 0; i < diagnostics.length; i++) {
        const diagnostic = diagnostics[i]
        const result = this.highlightDiagnostic(path, diagnostic, content, {
          contextLines,
          showLineNumbers,
          wrapLines,
          maxWidth,
          truncateLines,
        })

        results.push(result)

        if (i < diagnostics.length - 1) {
          const width = LineWrapper.getTerminalWidth()
          const progressText = `[${i + 1}/${diagnostics.length}]`
          const rightPadding = 16
          const separatorLength = Math.max(0, width - progressText.length - 1 - rightPadding)
          const separator = '⎯'
          const leftSeparator = separator.repeat(separatorLength)
          const rightSeparator = separator.repeat(4)
          const progress = progressText

          results.push(`${leftSeparator}  ${progress} ${rightSeparator}`)
        }
      }
      return results.join("\n\n")
    }

    // Case 2: Inline diagnostics - show whole file with diagnostics inline
    if (diagnostics.length > 0) {
      return this.inlineDiagnosticRenderer.render(
        path,
        content,
        diagnostics,
        contextLines,
        showLineNumbers,
        wrapLines,
        maxWidth,
        truncateLines,
      )
    }

    // Case 3: Focus line - show only specific line with context
    if (focusLine) {
      return this.fileRenderer.renderWithFocusLine(
        path,
        content,
        focusLine,
        contextLines,
        showLineNumbers,
        maxWidth,
        wrapLines,
        truncateLines,
      )
    }

    // Case 4: Default - just highlight the whole file
    if (showLineNumbers) {
      return this.fileRenderer.renderWithLineNumbers(path, content, wrapLines, maxWidth, truncateLines)
    } else {
      return this.fileRenderer.renderPlain(content, maxWidth, wrapLines, truncateLines)
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
    options: HighlightDiagnosticOptions = {},
  ): string {
    this.requireInitialized()

    return this.diagnosticRenderer.renderSingle(
      path,
      diagnostic,
      content,
      options,
    )
  }

  // File reading wrapper functions

  /**
   * Convenience method that reads a file and highlights it
   * @param filePath - Path to the file to read and highlight
   * @param options - Configuration options
   * @returns The highlighted file content with optional diagnostics
   */
  highlightFileFromPath(
    filePath: string,
    options: HighlightOptions = {},
  ): string {
    return this.fileReader.highlightFromPath(filePath, options)
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
    options: HighlightDiagnosticOptions = {},
  ): string {
    return this.fileReader.highlightDiagnosticFromPath(filePath, diagnostic, options)
  }
}

/**
 * Convenience function to highlight content with a specific theme
 * @param content - The content to highlight
 * @param theme - The theme to use (defaults to "onedark")
 * @param options - Additional highlighting options
 * @returns The highlighted content
 */
export async function highlightContent(
  content: string,
  theme: ThemeInput = "onedark",
  options: HighlightOptions = {}
): Promise<string> {
  const highlighter = new Highlighter(theme)
  await highlighter.initialize()
  return highlighter.highlight("", content, options)
}

/**
 * Convenience function to highlight a file with a specific theme
 * @param filePath - The path to the file to highlight
 * @param theme - The theme to use (defaults to "onedark")
 * @param options - Additional highlighting options
 * @returns The highlighted file content
 */
export async function highlightFile(
  filePath: string,
  theme: ThemeInput = "onedark",
  options: HighlightOptions = {}
): Promise<string> {
  const highlighter = new Highlighter(theme)
  await highlighter.initialize()
  return highlighter.highlightFileFromPath(filePath, options)
}
