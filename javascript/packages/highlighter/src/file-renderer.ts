import { LineWrapper } from "./line-wrapper.js"
import { DocumentBuilder } from "./document-builder.js"
import { AnsiSink } from "./ansi-sink.js"

import type { SyntaxRenderer } from "./syntax-renderer.js"

export class FileRenderer {
  private syntaxRenderer: SyntaxRenderer

  constructor(syntaxRenderer: SyntaxRenderer) {
    this.syntaxRenderer = syntaxRenderer
  }

  renderWithLineNumbers(path: string, content: string, wrapLines = false, maxWidth = LineWrapper.getTerminalWidth(), truncateLines = false): string {
    const document = new DocumentBuilder(this.syntaxRenderer).buildFile(path, content)
    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers: true, wrapLines, truncateLines, maxWidth })

    return sink.render(document)
  }

  renderWithFocusLine(
    path: string,
    content: string,
    focusLine: number,
    contextLines: number,
    showLineNumbers = true,
    maxWidth = LineWrapper.getTerminalWidth(),
    wrapLines = false,
    truncateLines = false,
  ): string {
    const document = new DocumentBuilder(this.syntaxRenderer).buildFocus(path, content, focusLine, contextLines)
    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers, wrapLines, truncateLines, maxWidth })

    return sink.render(document)
  }

  renderPlain(content: string, maxWidth = LineWrapper.getTerminalWidth(), wrapLines = false, truncateLines = false): string {
    const document = new DocumentBuilder(this.syntaxRenderer).buildPlain(content)
    const sink = new AnsiSink(this.syntaxRenderer, { showLineNumbers: false, wrapLines, truncateLines, maxWidth })

    return sink.render(document)
  }
}
