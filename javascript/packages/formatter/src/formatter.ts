import { Printer } from "./printer.js"
import { resolveFormatOptions } from "./options.js"

import type { FormatOptions } from "./options.js"
import type { HerbBackend, ParseResult, Node, Token } from "@herb-tools/core"
import type { Rewriter } from "@herb-tools/rewriter"

/**
 * Formatter uses a Herb Backend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class Formatter {
  private herb: HerbBackend
  private options: Required<Pick<FormatOptions, 'indentWidth' | 'maxLineLength'>> & Pick<FormatOptions, 'rewriters'>

  constructor(herb: HerbBackend, options: FormatOptions = {}) {
    this.herb = herb
    this.options = resolveFormatOptions(options)
  }

  /**
   * Format a source string, optionally overriding format options per call.
   * 
   * Pipeline:
   * 1. Parse source to document
   * 2. Run "before" rewriters on document (e.g., class sorting)
   * 3. Format document to string
   * 4. Run "after" rewriters on formatted string (if any)
   */
  format(source: string, options: FormatOptions = {}): string {
    const result = this.parse(source)
    if (result.failed) return source

    const resolvedOptions = resolveFormatOptions({ ...this.options, ...options })

    // Step 1: Run "before" rewriters on the document
    this.runRewriters(result.value, resolvedOptions.rewriters?.before)

    // Step 2: Format the document to string
    let formatted = new Printer(source, {
      indentWidth: resolvedOptions.indentWidth,
      maxLineLength: resolvedOptions.maxLineLength
    }).print(result.value)

    // Step 3: Run "after" rewriters if any exist
    const afterRewriters = resolvedOptions.rewriters?.after
    if (afterRewriters && afterRewriters.length > 0) {
      // Parse the formatted string to get a new document
      const afterParseResult = this.parse(formatted)
      if (!afterParseResult.failed) {
        // Run after rewriters on the new document
        this.runRewriters(afterParseResult.value, afterRewriters)
        // Format again to get the final result
        formatted = new Printer(formatted, {
          indentWidth: resolvedOptions.indentWidth,
          maxLineLength: resolvedOptions.maxLineLength
        }).print(afterParseResult.value)
      }
    }

    return formatted
  }

  /**
   * Run a list of rewriters on a document
   */
  private runRewriters(document: Node | Token, rewriters?: Rewriter[]): void {
    if (!rewriters || rewriters.length === 0) return

    for (const rewriter of rewriters) {
      if (rewriter && rewriter.isEnabled()) {
        rewriter.process(document)
      }
    }
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()
    return this.herb.parse(source)
  }
}
