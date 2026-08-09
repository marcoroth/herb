import { LineWrapper } from "./line-wrapper.js"
import { DocumentBuilder } from "./document-builder.js"
import { AnsiSink } from "./ansi-sink.js"

import type { Diagnostic } from "@herb-tools/core"
import type { SyntaxRenderer } from "./syntax-renderer.js"

export class InlineDiagnosticRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  render(
    path: string,
    content: string,
    diagnostics: Diagnostic[],
    showLineNumbers = true,
    wrapLines = false,
    maxWidth = LineWrapper.getTerminalWidth(),
    truncateLines = false,
    codeUrlBuilder?: (code: string) => string,
  ): string {
    const builder = new DocumentBuilder(this.syntaxRenderer)
    const document = builder.buildInline(path, content, diagnostics, codeUrlBuilder)

    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers, wrapLines, truncateLines, maxWidth })

    return sink.render(document)
  }
}
