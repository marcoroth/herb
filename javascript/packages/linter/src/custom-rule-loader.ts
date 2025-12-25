import { pathToFileURL } from "url"
import { glob } from "glob"

import type { RuleClass } from "./types.js"

export interface CustomRuleLoaderOptions {
  /**
   * Base directory to search for custom rules
   * Defaults to current working directory
   */
  baseDir?: string

  /**
   * Glob patterns to search for custom rule files
   * Defaults to looking in common locations
   */
  patterns?: string[]

  /**
   * Whether to suppress errors when loading custom rules
   * Defaults to false
   */
  silent?: boolean
}

const DEFAULT_PATTERNS = [
  ".herb/rules/**/*.mjs",
]

/**
 * Loads custom linter rules from the user's project
 */
export class CustomRuleLoader {
  private baseDir: string
  private patterns: string[]
  private silent: boolean

  constructor(options: CustomRuleLoaderOptions = {}) {
    this.baseDir = options.baseDir || process.cwd()
    this.patterns = options.patterns || DEFAULT_PATTERNS
    this.silent = options.silent || false
  }

  /**
   * Discovers custom rule files in the project
   */
  async discoverRuleFiles(): Promise<string[]> {
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
   * Loads a single rule file
   */
  async loadRuleFile(filePath: string): Promise<RuleClass[]> {
    try {
      const fileUrl = pathToFileURL(filePath).href
      const cacheBustedUrl = `${fileUrl}?t=${Date.now()}`
      const module = await import(cacheBustedUrl)

      if (module.default && this.isValidRuleClass(module.default)) {
        return [module.default]
      }

      if (!this.silent) {
        console.warn(`Warning: No valid default export found in "${filePath}". Custom rules must use default export.`)
      }

      return []
    } catch (error) {
      if (!this.silent) {
        console.error(`Error loading rule file "${filePath}": ${error}`)
      }
      return []
    }
  }

  /**
   * Type guard to check if an export is a valid rule class
   */
  private isValidRuleClass(value: any): value is RuleClass {
    if (typeof value !== 'function') return false
    if (!value.prototype) return false

    const instance = new value()

    return typeof instance.check === 'function' && typeof instance.name === 'string'
  }

  /**
   * Loads all custom rules from the project
   */
  async loadRules(): Promise<RuleClass[]> {
    const ruleFiles = await this.discoverRuleFiles()

    if (ruleFiles.length === 0) {
      return []
    }

    const allRules: RuleClass[] = []

    for (const filePath of ruleFiles) {
      const rules = await this.loadRuleFile(filePath)
      allRules.push(...rules)
    }

    return allRules
  }

  /**
   * Loads all custom rules and returns detailed information about each rule
   */
  async loadRulesWithInfo(): Promise<{ rules: RuleClass[], ruleInfo: Array<{ name: string, path: string }>, duplicateWarnings: string[] }> {
    const ruleFiles = await this.discoverRuleFiles()

    if (ruleFiles.length === 0) {
      return { rules: [], ruleInfo: [], duplicateWarnings: [] }
    }

    const allRules: RuleClass[] = []
    const ruleInfo: Array<{ name: string, path: string }> = []
    const duplicateWarnings: string[] = []
    const seenNames = new Map<string, string>()

    for (const filePath of ruleFiles) {
      const rules = await this.loadRuleFile(filePath)
      for (const RuleClass of rules) {
        const instance = new RuleClass()
        const ruleName = instance.name

        if (seenNames.has(ruleName)) {
          const firstPath = seenNames.get(ruleName)!
          duplicateWarnings.push(
            `Custom rule "${ruleName}" is defined in multiple files: "${firstPath}" and "${filePath}". The later one will be used.`
          )
        } else {
          seenNames.set(ruleName, filePath)
        }

        allRules.push(RuleClass)
        ruleInfo.push({
          name: ruleName,
          path: filePath
        })
      }
    }

    return { rules: allRules, ruleInfo, duplicateWarnings }
  }

  /**
   * Static helper to check if custom rules exist in a project
   */
  static async hasCustomRules(baseDir: string = process.cwd()): Promise<boolean> {
    const loader = new CustomRuleLoader({ baseDir, silent: true })
    const files = await loader.discoverRuleFiles()
    return files.length > 0
  }

  /**
   * Static helper to load custom rules and merge with default rules
   */
  static async loadAndMergeRules(
    defaultRules: RuleClass[],
    options: CustomRuleLoaderOptions = {}
  ): Promise<RuleClass[]> {
    const loader = new CustomRuleLoader(options)
    const customRules = await loader.loadRules()

    return [...defaultRules, ...customRules]
  }
}
