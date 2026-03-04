import { FormatPrinter } from "./format-printer.js"

import { isScaffoldTemplate } from "./scaffold-template-detector.js"
import { resolveFormatOptions } from "./options.js"
import { hasFormatterIgnoreDirective } from "./format-ignore.js"

import type { Config } from "@herb-tools/config"
import type { RewriteContext } from "@herb-tools/rewriter"
import type { HerbBackend, ParseResult } from "@herb-tools/core"
import type { FormatOptions } from "./options.js"

/**
 * Formatter uses a Herb Backend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class Formatter {
  private herb: HerbBackend
  private options: Required<FormatOptions>

  /**
   * Creates a Formatter instance from a Config object (recommended).
   *
   * @param herb - The Herb backend instance for parsing
   * @param config - Optional Config instance for formatter options
   * @param options - Additional options to override config
   * @returns A configured Formatter instance
   */
  static from(
    herb: HerbBackend,
    config?: Config,
    options: FormatOptions = {}
  ): Formatter {
    const formatterConfig = config?.formatter || {}

    const mergedOptions: FormatOptions = {
      indentWidth: options.indentWidth ?? formatterConfig.indentWidth,
      maxLineLength: options.maxLineLength ?? formatterConfig.maxLineLength,
      preRewriters: options.preRewriters,
      postRewriters: options.postRewriters,
    }

    return new Formatter(herb, mergedOptions)
  }

  /**
   * Creates a new Formatter instance.
   *
   * @param herb - The Herb backend instance for parsing
   * @param options - Format options (including rewriters)
   */
  constructor(herb: HerbBackend, options: FormatOptions = {}) {
    this.herb = herb
    this.options = resolveFormatOptions(options)
  }

  /**
   * Format a source string, optionally overriding format options per call.
   */
  format(source: string, options: FormatOptions = {}, filePath?: string): string {
    const result = this.parse(source)

    if (result.failed) return source
    if (isScaffoldTemplate(result)) return source
    if (hasFormatterIgnoreDirective(result.value)) return source

    const resolvedOptions = resolveFormatOptions({ ...this.options, ...options })

    let node = result.value

    if (resolvedOptions.preRewriters.length > 0) {
      const context: RewriteContext = {
        filePath,
        baseDir: process.cwd() // TODO: format() shouldn't depend on node internals
      }

      for (const rewriter of resolvedOptions.preRewriters) {
        try {
          node = rewriter.rewrite(node, context)
        } catch (error) {
          console.error(`Pre-format rewriter "${rewriter.name}" failed:`, error)
        }
      }
    }

    let formatted = new FormatPrinter(source, resolvedOptions).print(node)

    if (resolvedOptions.postRewriters.length > 0) {
      const context: RewriteContext = {
        filePath,
        baseDir: process.cwd() // TODO: format() shouldn't depend on node internals
      }

      for (const rewriter of resolvedOptions.postRewriters) {
        try {
          formatted = rewriter.rewrite(formatted, context)
        } catch (error) {
          console.error(`Post-format rewriter "${rewriter.name}" failed:`, error)
        }
      }
    }

    return formatted
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()
    return this.herb.parse(source)
  }
}
