import { Printer, PrinterOptions } from "@herb-tools/printer"

export interface MinifyingPrinterOptions extends PrinterOptions {
  collapseWhitespace?: boolean
  collapseMultipleSpaces?: boolean
  collapseMultipleNewlines?: boolean
  preserveLineBreaks?: boolean
  trimTextNodes?: boolean
}

export const DEFAULT_MINIFYING_OPTIONS: MinifyingPrinterOptions = {
  // Base printer options
  indentSize: 0,
  indentChar: ' ',
  lineEnding: '\n',
  insertFinalNewline: false,

  // Minification-specific options
  collapseWhitespace: true,
  collapseMultipleSpaces: true,
  collapseMultipleNewlines: true,
  preserveLineBreaks: false,
  preserveWhitespace: ["pre", "code", "script", "style", "textarea"],
  trimTextNodes: true
}

export class MinifyingPrinter extends Printer {
  constructor(options: Partial<MinifyingPrinterOptions> = {}) {
    super({ ...DEFAULT_MINIFYING_OPTIONS, ...options })
  }

  /**
   * Override text content printing to apply minification
   */
  protected printTextContent(content: string): void {
    if (this.context.shouldPreserveWhitespace()) {
      // In preserve mode, output content as-is
      this.context.write(content)
      return
    }

    let minified = content
    const opts = this.options as MinifyingPrinterOptions

    // Apply minification rules based on options
    if (opts.collapseMultipleSpaces) {
      // Replace multiple spaces with single space
      minified = minified.replace(/ +/g, ' ')
    }

    if (opts.collapseMultipleNewlines) {
      // Replace multiple newlines (with optional whitespace between) with single newline
      minified = minified.replace(/(\r?\n\s*)+/g, '\n')
    }

    if (opts.collapseWhitespace && !opts.preserveLineBreaks) {
      // Replace all whitespace sequences with single space
      minified = minified.replace(/\s+/g, ' ')
    }

    if (opts.trimTextNodes) {
      // Only trim if the entire node is whitespace
      if (minified.trim() === '') {
        minified = ''
      }
    }

    this.context.write(minified)
  }

  /**
   * Override ERB node printing to apply compact spacing
   */
  protected printERBNode(node: any): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }
    if (node.content) {
      // For minification, use compact spacing (no extra spaces)
      this.context.write(node.content.value)
    }
    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }
}
