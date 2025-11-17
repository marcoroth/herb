import { Location } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"
import { minimatch } from "minimatch"

import { rules } from "./rules.js"
import { findNodeByLocation } from "./rules/rule-utils.js"
import { parseHerbDisableLine } from "./herb-disable-comment-utils.js"
import { hasLinterIgnoreDirective } from "./linter-ignore.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"
import { DEFAULT_RULE_CONFIG } from "./types.js"

import type { RuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense, UnboundLintOffense, LintContext, AutofixResult } from "./types.js"
import type { ParseResult, LexResult, HerbBackend } from "@herb-tools/core"
import type { RuleConfig, Config } from "@herb-tools/config"

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
  protected allAvailableRules: RuleClass[]
  protected herb: HerbBackend
  protected offenses: LintOffense[]
  protected config?: Config

  /**
   * Creates a new Linter instance with automatic rule filtering based on config.
   *
   * @param herb - The Herb backend instance for parsing and lexing
   * @param config - Optional full Config instance for rule filtering, severity overrides, and path-based filtering
   * @param customRules - Optional array of custom rules to include alongside built-in rules
   * @returns A configured Linter instance
   */
  static from(herb: HerbBackend, config?: Config, customRules?: RuleClass[]): Linter {
    const allRules = customRules ? [...rules, ...customRules] : rules
    const filteredRules = config?.linter?.rules
      ? Linter.filterRulesByConfig(allRules, config.linter.rules)
      : undefined

    return new Linter(herb, filteredRules, config, allRules)
  }

  /**
   * Creates a new Linter instance.
   *
   * For most use cases, prefer `Linter.from()` which handles config-based filtering.
   * Use this constructor directly when you need explicit control over rules.
   *
   * @param herb - The Herb backend instance for parsing and lexing
   * @param rules - Array of rule classes (Parser/AST or Lexer) to use. If not provided, uses default rules.
   * @param config - Optional full Config instance for severity overrides and path-based rule filtering
   * @param allAvailableRules - Optional array of ALL available rules (including disabled) for herb:disable validation
   */
  constructor(herb: HerbBackend, rules?: RuleClass[], config?: Config, allAvailableRules?: RuleClass[]) {
    this.herb = herb
    this.config = config
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.allAvailableRules = allAvailableRules !== undefined ? allAvailableRules : this.rules
    this.offenses = []
  }

  /**
   * Filters rules based on default config and optional user config overrides.
   *
   * Priority:
   * 1. User config override (if rule config exists in userRulesConfig)
   * 2. Default config from rule's defaultConfig getter
   *
   * @param allRules - All available rule classes to filter from
   * @param userRulesConfig - Optional user configuration for rules
   * @returns Filtered array of rule classes that should be enabled
   */
  static filterRulesByConfig(
    allRules: RuleClass[],
    userRulesConfig?: Record<string, RuleConfig>
  ): RuleClass[] {
    return allRules.filter(ruleClass => {
      const instance = new ruleClass()
      const ruleName = instance.name

      const defaultEnabled = instance.defaultConfig?.enabled ?? DEFAULT_RULE_CONFIG.enabled
      const userRuleConfig = userRulesConfig?.[ruleName]

      if (userRuleConfig !== undefined) {
        return userRuleConfig.enabled !== false
      }

      return defaultEnabled
    })
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * These are the rules enabled when no custom rules are provided.
   * Filters all available rules to only include those enabled by default.
   * @returns Array of default rule classes
   */
  protected getDefaultRules(): RuleClass[] {
    return Linter.filterRulesByConfig(rules)
  }

  /**
   * Returns all available rule classes that can be referenced in herb:disable comments.
   * This includes all rules that exist, regardless of whether they're currently enabled.
   * Includes both built-in rules and any loaded custom rules.
   * @returns Array of all available rule classes
   */
  protected getAvailableRules(): RuleClass[] {
    return this.allAvailableRules
  }

  /**
   * Meta-linting rules for herb:disable comments cannot be disabled
   * This ensures that invalid herb:disable comments are always caught
   */
  protected get nonExcludableRules() {
    return [
      "herb-disable-comment-valid-rule-name",
      "herb-disable-comment-no-redundant-all",
      "herb-disable-comment-no-duplicate-rules",
      "herb-disable-comment-malformed",
      "herb-disable-comment-missing-rules",
      "herb-disable-comment-unnecessary"
    ]
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
   * Execute a single rule and return its unbound offenses.
   * Handles rule type checking (Lexer/Parser/Source) and isEnabled checks.
   */
  private executeRule(
    rule: Rule,
    parseResult: ParseResult,
    lexResult: LexResult,
    source: string,
    context?: Partial<LintContext>
  ): UnboundLintOffense[] {
    if (this.config && context?.fileName) {
      if (!this.config.isRuleEnabledForPath(rule.name, context.fileName)) {
        return []
      }
    }

    if (context?.fileName && !this.config?.linter?.rules?.[rule.name]?.exclude) {
      const defaultExclude = rule.defaultConfig?.exclude ?? DEFAULT_RULE_CONFIG.exclude

      if (defaultExclude && defaultExclude.length > 0) {
        const isExcluded = defaultExclude.some((pattern: string) => minimatch(context.fileName!, pattern))

        if (isExcluded) {
          return []
        }
      }
    }

    let isEnabled = true
    let ruleOffenses: UnboundLintOffense[]

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

    return ruleOffenses
  }

  private filterOffenses(
    ruleOffenses: LintOffense[],
    ruleName: string,
    ignoredOffensesByLine?: Map<number, Set<string>>,
    herbDisableCache?: Map<number, string[]>,
    ignoreDisableComments?: boolean
  ): { kept: LintOffense[], ignored: LintOffense[], wouldBeIgnored: LintOffense[] } {
    const kept: LintOffense[] = []
    const ignored: LintOffense[] = []
    const wouldBeIgnored: LintOffense[] = []

    if (this.nonExcludableRules.includes(ruleName)) {
      return { kept: ruleOffenses, ignored: [], wouldBeIgnored: [] }
    }

    if (ignoreDisableComments) {
      for (const offense of ruleOffenses) {
        const line = offense.location.start.line
        const disabledRules = herbDisableCache?.get(line) || []

        if (disabledRules.includes(ruleName) || disabledRules.includes("all")) {
          wouldBeIgnored.push(offense)
        }
      }

      return { kept: ruleOffenses, ignored: [], wouldBeIgnored }
    }

    for (const offense of ruleOffenses) {
      const line = offense.location.start.line
      const disabledRules = herbDisableCache?.get(line) || []

      if (disabledRules.includes(ruleName) || disabledRules.includes("all")) {
        ignored.push(offense)

        if (ignoredOffensesByLine) {
          if (!ignoredOffensesByLine.has(line)) {
            ignoredOffensesByLine.set(line, new Set())
          }

          const usedRuleName = disabledRules.includes(ruleName) ? ruleName : "all"
          ignoredOffensesByLine.get(line)!.add(usedRuleName)
        }

        continue
      }

      kept.push(offense)
    }

    return { kept, ignored, wouldBeIgnored: [] }
  }


  /**
   * Lint source code using Parser/AST, Lexer, and Source rules.
   * @param source - The source code to lint
   * @param context - Optional context for linting (e.g., fileName for distinguishing files vs snippets)
   */
  lint(source: string, context?: Partial<LintContext>): LintResult {
    this.offenses = []

    let ignoredCount = 0
    let wouldBeIgnoredCount = 0

    const parseResult = this.herb.parse(source, { track_whitespace: true })

    // Check for file-level ignore directive using visitor
    if (hasLinterIgnoreDirective(parseResult)) {
      return {
        offenses: [],
        errors: 0,
        warnings: 0,
        info: 0,
        hints: 0,
        ignored: 0
      }
    }
    const lexResult = this.herb.lex(source)
    const hasParserErrors = parseResult.recursiveErrors().length > 0
    const sourceLines = source.split("\n")
    const ignoredOffensesByLine = new Map<number, Set<string>>()
    const herbDisableCache = new Map<number, string[]>()

    if (hasParserErrors) {
      const hasParserRule = this.rules.find(RuleClass => (new RuleClass()).name === "parser-no-errors")

      if (hasParserRule) {
        const rule = new ParserNoErrorsRule()
        const offenses = rule.check(parseResult)
        this.offenses.push(...offenses)
      }

      return {
        offenses: this.offenses,
        errors: this.offenses.filter(o => o.severity === "error").length,
        warnings: this.offenses.filter(o => o.severity === "warning").length,
        info: this.offenses.filter(o => o.severity === "info").length,
        hints: this.offenses.filter(o => o.severity === "hint").length,
        ignored: 0
      }
    }

    for (let i = 0; i < sourceLines.length; i++) {
      const line = sourceLines[i]

      if (line.includes("herb:disable")) {
        const herbDisable = parseHerbDisableLine(line)
        herbDisableCache.set(i + 1, herbDisable?.ruleNames || [])
      }
    }

    context = {
      ...context,
      validRuleNames: this.getAvailableRules().map(RuleClass => new RuleClass().name),
      ignoredOffensesByLine
    }

    const regularRules = this.rules.filter(RuleClass => {
      const rule = new RuleClass()

      return rule.name !== "herb-disable-comment-unnecessary"
    })

    for (const RuleClass of regularRules) {
      const rule = new RuleClass()
      const unboundOffenses = this.executeRule(rule, parseResult, lexResult, source, context)
      const boundOffenses = this.bindSeverity(unboundOffenses, rule.name)

      const { kept, ignored, wouldBeIgnored } = this.filterOffenses(
        boundOffenses,
        rule.name,
        ignoredOffensesByLine,
        herbDisableCache,
        context?.ignoreDisableComments
      )

      ignoredCount += ignored.length
      wouldBeIgnoredCount += wouldBeIgnored.length
      this.offenses.push(...kept)
    }

    const unnecessaryRuleClass = this.rules.find(RuleClass => {
      const rule = new RuleClass()

      return rule.name === "herb-disable-comment-unnecessary"
    })

    if (unnecessaryRuleClass) {
      const unnecessaryRule = new unnecessaryRuleClass() as ParserRule
      const unboundOffenses = unnecessaryRule.check(parseResult, context)
      const boundOffenses = this.bindSeverity(unboundOffenses, unnecessaryRule.name)

      this.offenses.push(...boundOffenses)
    }

    const finalOffenses = this.offenses

    const errors = finalOffenses.filter(offense => offense.severity === "error").length
    const warnings = finalOffenses.filter(offense => offense.severity === "warning").length
    const info = finalOffenses.filter(offense => offense.severity === "info").length
    const hints = finalOffenses.filter(offense => offense.severity === "hint").length

    const result: LintResult = {
      offenses: finalOffenses,
      errors,
      warnings,
      info,
      hints,
      ignored: ignoredCount
    }

    if (wouldBeIgnoredCount > 0) {
      result.wouldBeIgnored = wouldBeIgnoredCount
    }

    return result
  }

  /**
   * Bind severity to unbound offenses based on rule's defaultConfig and user config overrides.
   *
   * Priority:
   * 1. User config severity override (if specified in config)
   * 2. Rule's default severity (from defaultConfig.severity)
   *
   * @param unboundOffenses - Array of offenses without severity
   * @param ruleName - Name of the rule that produced the offenses
   * @returns Array of offenses with severity bound
   */
  protected bindSeverity(unboundOffenses: UnboundLintOffense[], ruleName: string): LintOffense[] {
    const RuleClass = this.rules.find(rule => {
      const instance = new rule()
      return instance.name === ruleName
    })

    if (!RuleClass) {
      return unboundOffenses.map(offense => ({
        ...offense,
        severity: "error" as const
      }))
    }

    const ruleInstance = new RuleClass()
    const defaultSeverity = ruleInstance.defaultConfig?.severity ?? DEFAULT_RULE_CONFIG.severity

    const userRuleConfig = this.config?.linter?.rules?.[ruleName]
    const severity = userRuleConfig?.severity ?? defaultSeverity

    return unboundOffenses.map(offense => ({
      ...offense,
      severity
    }))
  }

  /**
   * Automatically fix offenses in the source code.
   * Uses AST mutation for parser rules and token mutation for lexer rules.
   * @param source - The source code to fix
   * @param context - Optional context for linting (e.g., fileName)
   * @param offensesToFix - Optional array of specific offenses to fix. If not provided, all fixable offenses will be fixed.
   * @returns AutofixResult containing the corrected source and lists of fixed/unfixed offenses
   */
  autofix(source: string, context?: Partial<LintContext>, offensesToFix?: LintOffense[]): AutofixResult {
    const lintResult = offensesToFix ? { offenses: offensesToFix } : this.lint(source, context)

    const parserOffenses: LintOffense[] = []
    const lexerOffenses: LintOffense[] = []
    const sourceOffenses: LintOffense[] = []

    for (const offense of lintResult.offenses) {
      const RuleClass = this.rules.find(rule => {
        const instance = new rule()

        return instance.name === offense.rule
      })

      if (!RuleClass) continue

      if ((RuleClass as any).type === "lexer") {
        lexerOffenses.push(offense)
      } else if ((RuleClass as any).type === "source") {
        sourceOffenses.push(offense)
      } else {
        parserOffenses.push(offense)
      }
    }

    let currentSource = source
    const fixed: LintOffense[] = []
    const unfixed: LintOffense[] = []

    if (parserOffenses.length > 0) {
      const parseResult = this.herb.parse(currentSource, { track_whitespace: true })

      for (const offense of parserOffenses) {
        const RuleClass = this.rules.find(rule => new rule().name === offense.rule)

        if (!RuleClass) {
          unfixed.push(offense)

          continue
        }

        const rule = new RuleClass() as ParserRule

        if (!rule.autofix) {
          unfixed.push(offense)

          continue
        }

        if (offense.autofixContext) {
          const originalNodeType = offense.autofixContext.node.type
          const location: Location = offense.autofixContext.node.location ? Location.from(offense.autofixContext.node.location) : offense.location

          const freshNode = findNodeByLocation(
            parseResult.value,
            location,
            (node) => node.type === originalNodeType
          )

          if (freshNode) {
            offense.autofixContext.node = freshNode
          } else {
            unfixed.push(offense)

            continue
          }
        }

        const fixedResult = rule.autofix(offense, parseResult, context)

        if (fixedResult) {
          fixed.push(offense)
        } else {
          unfixed.push(offense)
        }
      }

      if (fixed.length > 0) {
        const printer = new IdentityPrinter()
        currentSource = printer.print(parseResult.value)
      }
    }

    if (sourceOffenses.length > 0) {
      const sortedSourceOffenses = sourceOffenses.sort((a, b) => {
        if (a.location.start.line !== b.location.start.line) {
          return b.location.start.line - a.location.start.line
        }

        return b.location.start.column - a.location.start.column
      })

      for (const offense of sortedSourceOffenses) {
        const RuleClass = this.rules.find(rule => new rule().name === offense.rule)

        if (!RuleClass) {
          unfixed.push(offense)
          continue
        }

        const rule = new RuleClass() as SourceRule

        if (!rule.autofix) {
          unfixed.push(offense)
          continue
        }

        const correctedSource = rule.autofix(offense, currentSource, context)

        if (correctedSource) {
          currentSource = correctedSource
          fixed.push(offense)
        } else {
          unfixed.push(offense)
        }
      }
    }

    return {
      source: currentSource,
      fixed,
      unfixed
    }
  }
}

