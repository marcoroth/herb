import type { HerbBackend } from "@herb-tools/core"
import { FormatterPrinter } from "./printer"

import type { FormatOptions } from "./options"
import { resolveFormatOptions } from "./options"

/**
 * HerbFormatter uses HerbBackend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class HerbFormatter {
  constructor(private herb: HerbBackend) {}

  format(source: string, options: FormatOptions = {}): string {
    this.herb.ensureBackend()

    const result = this.herb.parse(source)
    if (result.failed()) return source

    const { indentWidth, maxLineLength } = resolveFormatOptions(options)
    const printer = new FormatterPrinter(
      result.source,
      indentWidth,
      maxLineLength,
    )

    return printer.print(result.value)
  }
}

export function format(
  herb: HerbBackend,
  source: string,
  options: FormatOptions = {},
): string {
  const formatter = new HerbFormatter(herb)

  return formatter.format(source, options)
}
