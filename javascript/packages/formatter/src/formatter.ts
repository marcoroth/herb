import { FormatPrinter } from "./format-printer.js"
import { resolveFormatOptions } from "./options.js"

import type { FormatOptions } from "./options.js"
import type { HerbBackend, ParseResult } from "@herb-tools/core"

/**
 * Formatter uses a Herb Backend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class Formatter {
  private herb: HerbBackend
  private options: Required<FormatOptions>

  constructor(herb: HerbBackend, options: FormatOptions = {}) {
    this.herb = herb
    this.options = resolveFormatOptions(options)
  }

  /**
   * Format a source string, optionally overriding format options per call.
   */
  format(source: string, options: FormatOptions = {}): string {
    const result = this.parse(source)
    if (result.failed) return source

    const resolvedOptions = resolveFormatOptions({ ...this.options, ...options })

    return new FormatPrinter(source, resolvedOptions).print(result.value)
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()
    return this.herb.parse(source)
  }
}
