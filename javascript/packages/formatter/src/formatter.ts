import { FormatPrinter } from "./format-printer.js"
import { convertIndentation } from "@herb-tools/printer"
import { BYTE_ORDER_MARK } from "@herb-tools/core"

import { isScaffoldTemplate } from "./scaffold-template-detector.js"
import { resolveFormatOptions } from "./options.js"
import { hasFormatterIgnoreDirective } from "./format-ignore.js"

import type { Config } from "@herb-tools/config"
import type { RewriteContext } from "@herb-tools/rewriter"
import type { HerbBackend, ParseResult, ParseOptions } from "@herb-tools/core"
import type { FormatOptions } from "./options.js"

export type FormatSkipReason = "parse-errors" | "scaffold" | "ignore-directive"

export interface FormatResult {
  output: string
  skipped: FormatSkipReason | null
  errorCount: number
}

/**
 * Formatter uses a Herb Backend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class Formatter {
  private herb: HerbBackend
  private options: Required<FormatOptions>
  private parseOptions: ParseOptions

  /**
   * Creates a Formatter instance from a Config object (recommended).
   *
   * @param herb - The Herb backend instance for parsing
   * @param config - Optional Config instance for formatter and parser options
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
      indentStyle: options.indentStyle ?? formatterConfig.indentStyle,
      maxLineLength: options.maxLineLength ?? formatterConfig.maxLineLength,
      preRewriters: options.preRewriters,
      postRewriters: options.postRewriters,
    }

    return new Formatter(herb, mergedOptions, config?.parserOptions ?? {})
  }

  /**
   * Creates a new Formatter instance.
   *
   * @param herb - The Herb backend instance for parsing
   * @param options - Format options (including rewriters)
   */
  constructor(herb: HerbBackend, options: FormatOptions = {}, parseOptions: ParseOptions = {}) {
    this.herb = herb
    this.options = resolveFormatOptions(options)
    this.parseOptions = parseOptions
  }

  /**
   * Format a source string, optionally overriding format options per call.
   */
  format(source: string, options: FormatOptions = {}, filePath?: string): string {
    return this.formatWithResult(source, options, filePath).output
  }

  formatWithResult(source: string, options: FormatOptions = {}, filePath?: string): FormatResult {
    const input = source.startsWith(BYTE_ORDER_MARK) ? source.slice(BYTE_ORDER_MARK.length) : source
    const result = this.parse(input)

    if (result.options.action_view_helpers) {
      console.warn("[Herb Formatter] Warning: Formatting a document parsed with `action_view_helpers: true`. The result may not be 100% accurate.")
    }

    const errors = result.recursiveErrors()

    if (errors.length > 0) {
      return this.formatPastStrictDiagnostics(input, source, options, filePath)
          ?? { output: source, skipped: "parse-errors", errorCount: errors.length }
    }

    if (isScaffoldTemplate(result)) return { output: source, skipped: "scaffold", errorCount: 0 }
    if (hasFormatterIgnoreDirective(result.value)) return { output: source, skipped: "ignore-directive", errorCount: 0 }

    return this.print(input, result, options, filePath)
  }

  /**
   * Formats a template only strict mode rejects, such as a `case` sharing an ERB tag with its
   * first condition. A parse without strict mode carries no errors for those, so the formatter
   * runs on that tree and keeps the result only when the output parses clean under strict. A
   * template that errors either way is a real parse failure and stays untouched.
   */
  private formatPastStrictDiagnostics(
    input: string,
    source: string,
    options: FormatOptions,
    filePath?: string
  ): FormatResult | null {
    const lax = this.herb.parse(input, { ...this.parseOptions, strict: false })

    if (lax.recursiveErrors().length > 0) return null
    if (isScaffoldTemplate(lax)) return { output: source, skipped: "scaffold", errorCount: 0 }
    if (hasFormatterIgnoreDirective(lax.value)) return { output: source, skipped: "ignore-directive", errorCount: 0 }

    const candidate = this.print(input, lax, options, filePath)
    const verified = this.herb.parse(candidate.output, { ...this.parseOptions, strict: true })

    if (verified.recursiveErrors().length > 0) return null

    return candidate
  }

  private print(input: string, result: ParseResult, options: FormatOptions, filePath?: string): FormatResult {
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

    let formatted = new FormatPrinter(input, resolvedOptions, this.herb).print(node)

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

    if (resolvedOptions.indentStyle === "tab") {
      formatted = convertIndentation(formatted, resolvedOptions.indentWidth, "tab")
    }

    return { output: formatted, skipped: null, errorCount: 0 }
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()
    return this.herb.parse(source, this.parseOptions)
  }
}
