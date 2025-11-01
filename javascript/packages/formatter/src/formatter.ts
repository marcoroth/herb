import { FormatPrinter } from "./format-printer.js"
import { CustomRewriterLoader, ASTRewriter, StringRewriter } from "@herb-tools/rewriter"

import { resolveFormatOptions } from "./options.js"
import { builtinRewriters } from "@herb-tools/rewriter"

import type { FormatOptions } from "./options.js"
import type { HerbBackend, ParseResult } from "@herb-tools/core"
import type { Config } from "@herb-tools/config"
import type { RewriterClass, RewriteContext } from "@herb-tools/rewriter"
import type { FormatterRewriterInfo, FormatterRewriterOptions } from "./types"

/**
 * Formatter uses a Herb Backend to parse the source and then
 * formats the resulting AST into a well-indented, wrapped string.
 */
export class Formatter {
  private herb: HerbBackend
  private options: Required<FormatOptions>
  private preRewriters: ASTRewriter[] = []
  private postRewriters: StringRewriter[] = []
  private rewritersLoaded: boolean = false

  /**
   * Creates a Formatter instance from a Config object (recommended).
   * Automatically loads rewriters from config if specified.
   *
   * @param herb - The Herb backend instance for parsing
   * @param config - Optional Config instance for formatter options and rewriters
   * @returns A configured Formatter instance with rewriters loaded and rewriter info
   */
  static async from(herb: HerbBackend, config?: Config): Promise<{ formatter: Formatter, rewriterInfo: FormatterRewriterInfo}> {
    const formatterConfig = config?.formatter || {}

    const options: FormatOptions = {
      indentWidth: formatterConfig.indentWidth,
      maxLineLength: formatterConfig.maxLineLength
    }

    const formatter = new Formatter(herb, options)
    const preNames = formatterConfig.rewriter?.pre || []
    const postNames = formatterConfig.rewriter?.post || []

    let rewriterInfo: FormatterRewriterInfo = {
      preCount: 0,
      postCount: 0,
      warnings: [],
      preNames,
      postNames
    }

    if (formatterConfig.rewriter) {
      const info = await formatter.loadRewriters({
        baseDir: config?.projectPath || process.cwd(),
        pre: preNames,
        post: postNames
      })

      rewriterInfo = { ...info, preNames, postNames }
    }

    return { formatter, rewriterInfo }
  }

  /**
   * Creates a new Formatter instance.
   *
   * For most use cases, prefer `Formatter.from()` which handles config-based setup.
   * Use this constructor directly when you need explicit control over options.
   *
   * @param herb - The Herb backend instance for parsing
   * @param options - Format options (indentWidth, maxLineLength)
   */
  constructor(herb: HerbBackend, options: FormatOptions = {}) {
    this.herb = herb
    this.options = resolveFormatOptions(options)
  }

  /**
   * Format a source string, optionally overriding format options per call.
   */
  format(source: string, options: FormatOptions = {}, filePath?: string): string {
    let result = this.parse(source)
    if (result.failed) return source

    if (this.preRewriters.length > 0) {
      const context: RewriteContext = {
        filePath,
        baseDir: process.cwd()
      }

      for (const rewriter of this.preRewriters) {
        try {
          result = rewriter.rewrite(result, context)
        } catch (error) {
          console.error(`Pre-format rewriter "${rewriter.name}" failed:`, error)
        }
      }
    }

    const resolvedOptions = resolveFormatOptions({ ...this.options, ...options })
    let formatted = new FormatPrinter(source, resolvedOptions).print(result.value)

    if (this.postRewriters.length > 0) {
      const context: RewriteContext = {
        filePath,
        baseDir: process.cwd()
      }

      for (const rewriter of this.postRewriters) {
        try {
          formatted = rewriter.rewrite(formatted, context)
        } catch (error) {
          console.error(`Post-format rewriter "${rewriter.name}" failed:`, error)
        }
      }
    }

    return formatted
  }

  /**
   * Load rewriters from configuration
   * This should be called once before formatting if rewriters are needed
   *
   * @param options - Rewriter loading options including which rewriters to enable
   * @returns Information about loaded rewriters
   */
  async loadRewriters(options: FormatterRewriterOptions = {}): Promise<{preCount: number, postCount: number, warnings: string[]}> {
    if (this.rewritersLoaded) {
      return { preCount: this.preRewriters.length, postCount: this.postRewriters.length, warnings: [] }
    }

    const baseDir = options.baseDir || process.cwd()
    const loadCustom = options.loadCustomRewriters !== false
    const preNames = options.pre || []
    const postNames = options.post || []

    const warnings: string[] = []
    const allRewriterClasses: RewriterClass[] = []

    allRewriterClasses.push(...builtinRewriters)

    if (loadCustom) {
      const loader = new CustomRewriterLoader({
        baseDir,
        patterns: options.patterns,
        silent: options.silent
      })

      const { rewriters: customRewriters, duplicateWarnings } = await loader.loadRewritersWithInfo()

      allRewriterClasses.push(...customRewriters)
      warnings.push(...duplicateWarnings)
    }

    const rewriterMap = new Map<string, RewriterClass>()

    for (const RewriterClass of allRewriterClasses) {
      const instance = new RewriterClass()
      const existingClass = rewriterMap.get(instance.name)

      if (existingClass) {
        warnings.push(
          `Rewriter "${instance.name}" is defined multiple times. Using the last definition.`
        )
      }

      rewriterMap.set(instance.name, RewriterClass)
    }

    const context: RewriteContext = {
      baseDir
    }

    for (const name of preNames) {
      const RewriterClass = rewriterMap.get(name)

      if (!RewriterClass) {
        warnings.push(`Pre-format rewriter "${name}" not found. Skipping.`)
        continue
      }

      const instance = new RewriterClass()

      if (!(instance instanceof ASTRewriter)) {
        warnings.push(`Rewriter "${name}" is not a PreFormatRewriter. Skipping.`)

        continue
      }

      try {
        await instance.initialize(context)

        this.preRewriters.push(instance as ASTRewriter)
      } catch (error) {
        warnings.push(`Failed to initialize pre-format rewriter "${name}": ${error}`)
      }
    }

    for (const name of postNames) {
      const RewriterClass = rewriterMap.get(name)

      if (!RewriterClass) {
        warnings.push(`Post-format rewriter "${name}" not found. Skipping.`)
        continue
      }

      const instance = new RewriterClass()

      if (!(instance instanceof StringRewriter)) {
        warnings.push(`Rewriter "${name}" is not a PostFormatRewriter. Skipping.`)

        continue
      }

      try {
        await instance.initialize(context)
        this.postRewriters.push(instance as StringRewriter)
      } catch (error) {
        warnings.push(`Failed to initialize post-format rewriter "${name}": ${error}`)
      }
    }

    this.rewritersLoaded = true

    return {
      preCount: this.preRewriters.length,
      postCount: this.postRewriters.length,
      warnings
    }
  }

  private parse(source: string): ParseResult {
    this.herb.ensureBackend()
    return this.herb.parse(source)
  }
}
