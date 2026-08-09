import { LineWrapper } from "./line-wrapper.js"
import { DocumentBuilder } from "./document-builder.js"
import { AnsiSink } from "./ansi-sink.js"

import type { SyntaxRenderer } from "./syntax-renderer.js"
import type { Diagnostic } from "@herb-tools/core"

export interface DiagnosticRenderOptions {
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

export class DiagnosticRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  renderSingle(
    path: string,
    diagnostic: Diagnostic,
    content: string,
    options: DiagnosticRenderOptions = {},
  ): string {
    const {
      contextLines = 2,
      showLineNumbers = true,
      optimizeHighlighting = true,
      wrapLines = true,
      maxWidth = LineWrapper.getTerminalWidth(),
      truncateLines = false,
      codeUrl,
      fileUrl,
      suffix,
    } = options

    const builder = new DocumentBuilder(this.syntaxRenderer)

    const document = builder.buildCard(path, diagnostic, content, {
      contextLines,
      optimizeHighlighting,
      codeUrl: codeUrl ?? null,
      fileUrl: fileUrl ?? null,
      suffix: suffix ?? null,
    })

    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers, wrapLines, truncateLines, maxWidth })

    return sink.render(document)
  }
}
