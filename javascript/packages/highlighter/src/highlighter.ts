import { readFileSync } from "fs"

import { SyntaxRenderer } from "./syntax-renderer.js"
import { DiagnosticRenderer } from "./diagnostic-renderer.js"
import { FileRenderer } from "./file-renderer.js"
import { InitializationManager } from "./initialization-manager.js"
import { InlineDiagnosticRenderer } from "./inline-diagnostic-renderer.js"
import { DiffRenderer } from "./diff-renderer.js"
import { DocumentBuilder } from "./document-builder.js"
import { AnsiSink } from "./ansi-sink.js"
import { LineWrapper } from "./line-wrapper.js"
import { resolveTheme } from "./themes.js"
import { DEFAULT_HTML_RENDER_OPTIONS, renderDocumentHTML, renderDocumentFragments } from "./html-sink.js"

import type { HerbBackend, Diagnostic } from "@herb-tools/core"
import type { ThemeInput, ColorScheme } from "./themes.js"
import type { DiffRenderOptions } from "./diff-renderer.js"
import type { DiffHunk } from "./diff-computer.js"
import type { HTMLRenderOptions, HTMLSinkOptions } from "./html-sink.js"
import type { Document } from "./document.js"
import type { CardOptions, DiffDocumentOptions } from "./document-builder.js"

export interface HighlightOptions {
  diagnostics?: Diagnostic[]
  splitDiagnostics?: boolean

  contextLines?: number
  focusLine?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  codeUrlBuilder?: (code: string) => string
  fileUrlBuilder?: (path: string, diagnostic: Diagnostic) => string
  suffixBuilder?: (diagnostic: Diagnostic) => string | undefined
}

export interface HighlightDiagnosticOptions {
  contextLines?: number
  showLineNumbers?: boolean
  optimizeHighlighting?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  codeUrl?: string
  fileUrl?: string
  suffix?: string
}

export class Highlighter {
  private syntaxRenderer: SyntaxRenderer
  private diagnosticRenderer: DiagnosticRenderer
  private fileRenderer: FileRenderer
  private initManager: InitializationManager
  private inlineDiagnosticRenderer: InlineDiagnosticRenderer
  private diffRenderer: DiffRenderer
  private documentBuilder: DocumentBuilder
  private colors: ColorScheme

  constructor(theme: ThemeInput = "onedark", herb?: HerbBackend) {
    const colors = resolveTheme(theme)
    this.colors = colors
    this.syntaxRenderer = new SyntaxRenderer(colors, herb)
    this.diagnosticRenderer = new DiagnosticRenderer(this.syntaxRenderer)
    this.fileRenderer = new FileRenderer(this.syntaxRenderer)
    this.initManager = new InitializationManager(herb)
    this.inlineDiagnosticRenderer = new InlineDiagnosticRenderer(this.syntaxRenderer)
    this.diffRenderer = new DiffRenderer(this.syntaxRenderer, colors)
    this.documentBuilder = new DocumentBuilder(this.syntaxRenderer)
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
      showLineNumbers = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
    } = options

    const document = this.buildDocument(path, content, options)
    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers, wrapLines, truncateLines, maxWidth }, this.colors)

    return sink.render(document)
  }

  /**
   * Build the document IR that highlight() renders
   * @param path - File path for annotation (display only, not used for reading)
   * @param content - The content to highlight
   * @param options - Configuration options, dispatched exactly like highlight()
   * @returns The document
   */
  buildDocument(
    path: string,
    content: string,
    options: HighlightOptions = {},
  ): Document {
    this.requireInitialized()

    const {
      diagnostics = [],
      splitDiagnostics = false,
      contextLines = 0,
      focusLine,
      showLineNumbers = true,
      codeUrlBuilder,
      fileUrlBuilder,
      suffixBuilder,
    } = options

    if (diagnostics.length > 0 && splitDiagnostics) {
      return this.documentBuilder.buildSplit(path, content, diagnostics, {
        contextLines,
        codeUrlBuilder,
        fileUrlBuilder,
        suffixBuilder,
      })
    }

    if (diagnostics.length > 0) {
      return this.documentBuilder.buildInline(path, content, diagnostics, codeUrlBuilder)
    }

    if (focusLine) {
      return this.documentBuilder.buildFocus(path, content, focusLine, contextLines)
    }

    if (showLineNumbers) {
      return this.documentBuilder.buildFile(path, content)
    }

    return this.documentBuilder.buildPlain(content)
  }

  /**
   * Build the document IR for a single diagnostic card
   * @param path - The file path to display in the diagnostic (display only)
   * @param diagnostic - The diagnostic message to render
   * @param content - The content to highlight
   * @param options - The card options
   * @returns The document
   */
  buildCard(
    path: string,
    diagnostic: Diagnostic,
    content: string,
    options: CardOptions,
  ): Document {
    this.requireInitialized()

    return this.documentBuilder.buildCard(path, diagnostic, content, options)
  }

  /**
   * Render the highlighted content as an HTML fragment
   * @param path - File path for annotation (display only, not used for reading)
   * @param content - The content to highlight
   * @param options - Configuration options
   *   - focusLine: Line number to focus on (shows only that line with dimmed context)
   *   - contextLines: Number of context lines around the focus line (default: 2)
   *   - showLineNumbers: Whether to show line numbers and the file path header (default: true)
   *   - themeLabel: Theme label emitted on the fragment (default: the default theme)
   * @returns The HTML fragment
   */
  highlightHTML(
    path: string,
    content: string,
    options: Partial<HTMLRenderOptions> = {},
  ): string {
    this.requireInitialized()

    const {
      focusLine,
      contextLines = DEFAULT_HTML_RENDER_OPTIONS.contextLines,
      showLineNumbers = DEFAULT_HTML_RENDER_OPTIONS.showLineNumbers,
      themeLabel = DEFAULT_HTML_RENDER_OPTIONS.themeLabel,
    } = options

    let document: Document

    if (focusLine !== undefined) {
      document = this.documentBuilder.buildFocus(path, content, focusLine, contextLines)
    } else if (showLineNumbers) {
      document = this.documentBuilder.buildFile(path, content)
    } else {
      document = this.documentBuilder.buildPlain(content)
    }

    return renderDocumentHTML(document, { themeLabel, showLineNumbers, markers: "spans" })
  }

  renderHTML(document: Document, options: HTMLSinkOptions): string {
    return renderDocumentHTML(document, options)
  }

  renderHTMLFragments(document: Document, options: HTMLSinkOptions): string[] {
    return renderDocumentFragments(document, options)
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

  /**
   * Render the change between two sources as a syntax-highlighted diff
   * @param path - File path shown above the diff (display only)
   * @param original - The source before the change
   * @param modified - The source after the change
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when the sources are identical
   */
  highlightDiff(
    path: string,
    original: string,
    modified: string,
    options: DiffRenderOptions = {},
  ): string {
    this.requireInitialized()

    return this.diffRenderer.render(path, original, modified, options)
  }

  /**
   * Render pre-computed diff hunks
   * @param path - File path shown above the diff (display only)
   * @param hunks - The hunks to render
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when there are no hunks
   */
  highlightDiffHunks(
    path: string,
    hunks: DiffHunk[],
    options: DiffRenderOptions = {},
  ): string {
    this.requireInitialized()

    return this.diffRenderer.renderFromHunks(path, hunks, options)
  }

  /**
   * Build the document IR for the change between two sources
   * @param path - File path shown above the diff (display only)
   * @param original - The source before the change
   * @param modified - The source after the change
   * @param options - Optional configuration
   * @returns The document, empty when the sources are identical
   */
  buildDiff(
    path: string,
    original: string,
    modified: string,
    options: Partial<DiffDocumentOptions> = {},
  ): Document {
    this.requireInitialized()

    return this.documentBuilder.buildDiff(path, original, modified, options)
  }

  /**
   * Build the document IR for pre-computed diff hunks
   * @param path - File path shown above the diff (display only)
   * @param hunks - The hunks to render
   * @param options - Optional configuration
   * @returns The document, empty when there are no hunks
   */
  buildDiffFromHunks(
    path: string,
    hunks: DiffHunk[],
    options: Partial<DiffDocumentOptions> = {},
  ): Document {
    this.requireInitialized()

    return this.documentBuilder.buildDiffFromHunks(path, hunks, options)
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
    this.requireInitialized()

    return this.highlight(filePath, readFile(filePath), options)
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
    this.requireInitialized()

    return this.highlightDiagnostic(filePath, diagnostic, readFile(filePath), options)
  }
}

function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8")
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
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
