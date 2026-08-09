import { AnsiSink } from "./ansi-sink.js"
import { DocumentBuilder } from "./document-builder.js"
import { LineWrapper } from "./line-wrapper.js"

import type { DiffHunk } from "./diff-computer.js"
import type { Document } from "./document.js"
import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { ColorScheme } from "./themes.js"

export interface DiffRenderOptions {
  contextLines?: number
  showLineNumbers?: boolean
  wrapLines?: boolean
  maxWidth?: number
  truncateLines?: boolean
  highlightInlineChanges?: boolean
  removedLineStyle?: "tint" | "dim" | "none"
  singleLineStyle?: "split" | "inline" | "auto"
  layout?: "unified" | "split"
  indent?: string
}

export class DiffRenderer {
  private syntaxRenderer: SyntaxRenderer
  private colors: ColorScheme
  private documentBuilder: DocumentBuilder

  constructor(syntaxRenderer: SyntaxRenderer, colors: ColorScheme) {
    this.syntaxRenderer = syntaxRenderer
    this.colors = colors
    this.documentBuilder = new DocumentBuilder(syntaxRenderer)
  }

  /**
   * Render the change between two sources as a syntax-highlighted diff.
   *
   * @param path - File path shown above the diff, omitted when empty
   * @param original - The source before the change
   * @param modified - The source after the change
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when the sources are identical
   */
  render(path: string, original: string, modified: string, options: DiffRenderOptions = {}): string {
    const { contextLines = 2, highlightInlineChanges = true } = options

    const document = this.documentBuilder.buildDiff(path, original, modified, { contextLines, highlightInlineChanges })

    return this.renderDocument(document, options)
  }

  /**
   * Render hunks without the sources they came from, reconstructing each side from the line
   * contents the hunks carry.
   *
   * Use this for hunks that arrived over a wire or were parsed from a unified diff. Each
   * side is highlighted as a standalone block, so a hunk that begins part-way through a tag
   * may lex slightly differently than it would with the whole file in hand.
   *
   * @param path - File path shown above the diff, omitted when empty
   * @param hunks - The hunks to render
   * @param options - Optional configuration
   * @returns The rendered diff, or an empty string when there are no hunks
   */
  renderFromHunks(path: string, hunks: DiffHunk[], options: DiffRenderOptions = {}): string {
    const { highlightInlineChanges = true } = options

    const document = this.documentBuilder.buildDiffFromHunks(path, hunks, { highlightInlineChanges })

    return this.renderDocument(document, options)
  }

  private renderDocument(document: Document, options: DiffRenderOptions): string {
    const {
      showLineNumbers = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
      removedLineStyle = "tint",
      singleLineStyle = "split",
      layout = "unified",
      indent = "",
    } = options

    const sink = new AnsiSink(this.syntaxRenderer, {
      showLineNumbers,
      wrapLines,
      truncateLines,
      maxWidth,
      removedLineStyle,
      singleLineStyle,
      layout,
      indent,
    }, this.colors)

    return sink.render(document)
  }
}
