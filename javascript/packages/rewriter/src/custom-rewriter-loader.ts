import { pathToFileURL } from "url"
import { glob } from "glob"
import { isRewriterClass } from "./type-guards.js"

import type { RewriterClass } from "./type-guards.js"

export interface CustomRewriterLoaderOptions {
  /**
   * Base directory to search for custom rewriters
   * Defaults to current working directory
   */
  baseDir?: string

  /**
   * Glob patterns to search for custom rewriter files
   * Defaults to looking in .herb/rewriters/
   */
  patterns?: string[]

  /**
   * Whether to suppress errors when loading custom rewriters
   * Defaults to false
   */
  silent?: boolean
}

const DEFAULT_PATTERNS = [
  ".herb/rewriters/**/*.mjs",
]

/**
 * Loads custom rewriters from the user's project
 *
 * Auto-discovers rewriter files in `.herb/rewriters/` by default
 * and dynamically imports them for use in the formatter.
 *
 * @example
 * ```typescript
 * const loader = new CustomRewriterLoader({ baseDir: process.cwd() })
 * const customRewriters = await loader.loadRewriters()
 * ```
 */
export class CustomRewriterLoader {
  private baseDir: string
  private patterns: string[]
  private silent: boolean

  constructor(options: CustomRewriterLoaderOptions = {}) {
    this.baseDir = options.baseDir || process.cwd()
    this.patterns = options.patterns || DEFAULT_PATTERNS
    this.silent = options.silent || false
  }

  /**
   * Discovers custom rewriter files in the project
   */
  async discoverRewriterFiles(): Promise<string[]> {
    const allFiles: string[] = []

    for (const pattern of this.patterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.baseDir,
          absolute: true,
          nodir: true
        })

        allFiles.push(...files)
      } catch (error) {
        if (!this.silent) {
          console.warn(`Warning: Failed to search pattern "${pattern}": ${error}`)
        }
      }
    }

    return [...new Set(allFiles)]
  }

  /**
   * Loads a single rewriter file
   */
  async loadRewriterFile(filePath: string): Promise<RewriterClass[]> {
    try {
      const fileUrl = pathToFileURL(filePath).href
      const cacheBustedUrl = `${fileUrl}?t=${Date.now()}`
      const module = await import(cacheBustedUrl)

      if (module.default && isRewriterClass(module.default)) {
        return [module.default]
      }

      if (!this.silent) {
        console.warn(`Warning: No valid default export found in "${filePath}". Custom rewriters must use default export.`)
      }

      return []
    } catch (error) {
      if (!this.silent) {
        console.error(`Error loading rewriter file "${filePath}": ${error}`)
      }
      return []
    }
  }

  /**
   * Loads all custom rewriters from the project
   */
  async loadRewriters(): Promise<RewriterClass[]> {
    const rewriterFiles = await this.discoverRewriterFiles()

    if (rewriterFiles.length === 0) {
      return []
    }

    const allRewriters: RewriterClass[] = []

    for (const filePath of rewriterFiles) {
      const rewriters = await this.loadRewriterFile(filePath)
      allRewriters.push(...rewriters)
    }

    return allRewriters
  }

  /**
   * Loads all custom rewriters and returns detailed information about each rewriter
   */
  async loadRewritersWithInfo(): Promise<{rewriters: RewriterClass[], rewriterInfo: Array<{ name: string, path: string }>, duplicateWarnings: string[]}> {
    const rewriterFiles = await this.discoverRewriterFiles()

    if (rewriterFiles.length === 0) {
      return { rewriters: [], rewriterInfo: [], duplicateWarnings: [] }
    }

    const allRewriters: RewriterClass[] = []
    const rewriterInfo: Array<{ name: string, path: string }> = []
    const duplicateWarnings: string[] = []
    const seenNames = new Map<string, string>()

    for (const filePath of rewriterFiles) {
      const rewriters = await this.loadRewriterFile(filePath)

      for (const RewriterClass of rewriters) {
        const instance = new RewriterClass()
        const rewriterName = instance.name

        if (seenNames.has(rewriterName)) {
          const firstPath = seenNames.get(rewriterName)!

          duplicateWarnings.push(
            `Custom rewriter "${rewriterName}" is defined in multiple files: "${firstPath}" and "${filePath}". The later one will be used.`
          )
        } else {
          seenNames.set(rewriterName, filePath)
        }

        allRewriters.push(RewriterClass)
        rewriterInfo.push({
          name: rewriterName,
          path: filePath
        })
      }
    }

    return { rewriters: allRewriters, rewriterInfo, duplicateWarnings }
  }

  /**
   * Static helper to check if custom rewriters exist in a project
   */
  static async hasCustomRewriters(baseDir: string = process.cwd()): Promise<boolean> {
    const loader = new CustomRewriterLoader({ baseDir, silent: true })
    const files = await loader.discoverRewriterFiles()

    return files.length > 0
  }

  /**
   * Static helper to load custom rewriters and merge with built-in rewriters
   */
  static async loadAndMergeRewriters(builtinRewriters: RewriterClass[], options: CustomRewriterLoaderOptions = {}): Promise<RewriterClass[]> {
    const loader = new CustomRewriterLoader(options)
    const customRewriters = await loader.loadRewriters()

    return [...builtinRewriters, ...customRewriters]
  }
}
