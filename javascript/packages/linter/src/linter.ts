import { defaultRules } from "./default-rules.js"
import { CustomRuleLoader } from "./custom-rule-loader.js"

import type { RuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense, LintContext } from "./types.js"
import type { HerbBackend } from "@herb-tools/core"

export interface LinterOptions {
  /**
   * Array of rule classes to use. If not provided, uses default rules.
   */
  rules?: RuleClass[]

  /**
   * Whether to load custom rules from the project.
   * Defaults to false for backward compatibility.
   */
  loadCustomRules?: boolean

  /**
   * Base directory to search for custom rules.
   * Defaults to current working directory.
   */
  customRulesBaseDir?: string

  /**
   * Custom glob patterns to search for rule files.
   */
  customRulesPatterns?: string[]

  /**
   * Whether to suppress custom rule loading errors.
   * Defaults to false.
   */
  silentCustomRules?: boolean
}

export class Linter {
  protected rules: RuleClass[]
  protected herb: HerbBackend
  protected offenses: LintOffense[]
  protected customRulesLoaded: boolean = false

  /**
   * Creates a new Linter instance.
   * @param herb - The Herb backend instance for parsing and lexing
   * @param options - Linter configuration options (rules, custom rule loading, etc.)
   *
   * @example
   * // Use default rules only
   * const linter = new Linter(Herb)
   *
   * @example
   * // Use default rules + custom rules from project
   * const linter = new Linter(Herb, { loadCustomRules: true })
   *
   * @example
   * // Use specific rules only
   * const linter = new Linter(Herb, { rules: [MyRule1, MyRule2] })
   */
  constructor(herb: HerbBackend, options?: LinterOptions) {
    this.herb = herb

    const opts = options || {}

    if (opts.rules !== undefined) {
      this.rules = opts.rules
    } else {
      this.rules = this.getDefaultRules()
    }

    this.offenses = []
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * @returns Array of rule classes
   */
  protected getDefaultRules(): RuleClass[] {
    return defaultRules
  }

  /**
   * Asynchronously loads custom rules and adds them to the linter.
   * This should be called after construction if loadCustomRules option is enabled.
   *
   * @param options - Custom rule loader options
   * @returns Promise that resolves to information about loaded custom rules
   */
  async loadCustomRules(options?: {
    baseDir?: string
    patterns?: string[]
    silent?: boolean
  }): Promise<{ count: number, ruleInfo: Array<{ name: string, path: string }>, warnings: string[] }> {
    if (this.customRulesLoaded) {
      return { count: 0, ruleInfo: [], warnings: [] }
    }

    const loader = new CustomRuleLoader(options)
    const { rules: customRules, ruleInfo, duplicateWarnings } = await loader.loadRulesWithInfo()
    const warnings: string[] = [...duplicateWarnings]

    if (customRules.length > 0) {
      const defaultRuleNames = new Set(
        this.rules.map(RuleClass => {
          const instance = new RuleClass()

          return instance.name
        })
      )

      for (const { name } of ruleInfo) {
        if (defaultRuleNames.has(name)) {
          warnings.push(`Custom rule "${name}" has the same name as a built-in rule and will override it`)
        }
      }

      this.rules = [...this.rules, ...customRules]
      this.customRulesLoaded = true
    }

    return { count: customRules.length, ruleInfo, warnings }
  }

  getRuleCount(): number {
    return this.rules.length
  }

  /**
   * Type guard to check if a rule is a LexerRule
   */
  protected isLexerRule(rule: Rule): rule is LexerRule {
    return (rule.constructor as any).type === "lexer"
  }

  /**
   * Type guard to check if a rule is a SourceRule
   */
  protected isSourceRule(rule: Rule): rule is SourceRule {
    return (rule.constructor as any).type === "source"
  }

  /**
   * Lint source code using Parser/AST, Lexer, and Source rules.
   * @param source - The source code to lint
   * @param context - Optional context for linting (e.g., fileName for distinguishing files vs snippets)
   */
  lint(source: string, context?: Partial<LintContext>): LintResult {
    this.offenses = []

    const parseResult = this.herb.parse(source, { track_whitespace: true })
    const lexResult = this.herb.lex(source)

    for (const RuleClass of this.rules) {
      const rule = new RuleClass()

      let isEnabled = true
      let ruleOffenses: LintOffense[]

      if (this.isLexerRule(rule)) {
        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(lexResult, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as LexerRule).check(lexResult, context)
        } else {
          ruleOffenses = []
        }

      } else if (this.isSourceRule(rule)) {
        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(source, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as SourceRule).check(source, context)
        } else {
          ruleOffenses = []
        }
      } else {
        if (rule.isEnabled) {
          isEnabled = rule.isEnabled(parseResult, context)
        }

        if (isEnabled) {
          ruleOffenses = (rule as ParserRule).check(parseResult, context)
        } else {
          ruleOffenses = []
        }
      }

      this.offenses.push(...ruleOffenses)
    }

    const errors = this.offenses.filter(offense => offense.severity === "error").length
    const warnings = this.offenses.filter(offense => offense.severity === "warning").length

    return {
      offenses: this.offenses,
      errors,
      warnings
    }
  }
}
