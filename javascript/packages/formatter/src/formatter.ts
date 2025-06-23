import { Printer } from "./printer.js"
import { resolveFormatOptions } from "./options.js"

import { readFileSync } from "fs"

import type { FormatOptions } from "./options.js"
import type { DocumentNode, HerbBackend, ParseResult } from "@herb-tools/core"

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

  format(source: string): string {
    const result = this.parse(source)

    if (result.failed) return source

    return this.formatDocument(result.value)
  }

  formatFile(path: string): string {
    const source = readFileSync(path, "utf8")

    return this.format(source)
  }

  formatDocument(document: DocumentNode): string {
    return this.printer.print(document)
  }

  private get printer(): Printer {
    return new Printer("", this.options)
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()

    return this.herb.parse(source)
  }
}
