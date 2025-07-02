import { Printer } from "./printer.js"
import type { PrinterOptions } from "./types.js"

/**
 * IdentityPrinter - Provides lossless reconstruction of the original source
 *
 * This printer aims to reconstruct the original input as faithfully as possible,
 * preserving all whitespace, formatting, and structure. It's useful for:
 * - Testing parser accuracy (input should equal output)
 * - Baseline printing before applying transformations
 * - Verifying AST round-trip fidelity
 */
export class IdentityPrinter extends Printer {
  constructor(options: Partial<PrinterOptions> = {}) {
    // Override defaults to preserve original formatting
    const identityDefaults: Partial<PrinterOptions> = {
      insertFinalNewline: false,
      preserveLineBreaks: true,
      collapseWhitespace: false,
      trimTextNodes: false,
      collapseMultipleSpaces: false,
      collapseMultipleNewlines: false,
      erbTagSpacing: 'spaced' // Preserve original spacing using spaced mode
    }

    super({ ...identityDefaults, ...options })
  }

  /**
   * Override ERB printing to preserve exact original spacing
   */
  protected printERBNode(node: any): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }
    if (node.content) {
      // For identity printing, preserve the exact content without modification
      this.context.write(node.content.value)
    }
    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }

  /**
   * Override text content to preserve exactly as-is
   */
  protected printTextContent(content: string): void {
    // Always preserve content exactly as parsed
    this.context.write(content)
  }
}
