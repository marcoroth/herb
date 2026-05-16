import picomatch from "picomatch"

import { Location } from "@herb-tools/core"
import { IdentityPrinter, IndentPrinter } from "@herb-tools/printer"

import { rules } from "./rules.js"
import { findNodeByLocation } from "./rules/rule-utils.js"
import { parseHerbDisableLine } from "./herb-disable-comment-utils.js"
import { hasLinterIgnoreDirective } from "./linter-ignore.js"
import { ParseCache } from "./parse-cache.js"

import { ParserNoErrorsRule } from "./rules/parser-no-errors.js"

import { DEFAULT_RULE_CONFIG } from "./types.js"
import { semverGreaterThan } from "./semver.js"
import { resolveSeverity } from "@herb-tools/config"

import type { RuleClass, ParserRuleClass, LexerRuleClass, SourceRuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense, UnboundLintOffense, LintContext, AutofixResult, RuleVersion, LinterMode } from "./types.js"
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

export interface VersionSkippedRule {
  ruleName: string
  introducedIn: RuleVersion
}

export interface FilterRulesResult {
  enabled: RuleClass[]
  skippedByVersion: VersionSkippedRule[]
  disabledByConfig: number
  notEnabledByDefault: number
}

export class Linter {
  public rules: RuleClass[]
  public rulesSkippedByVersion: VersionSkippedRule[] = []
  public rulesDisabledByConfig: number = 0
  public rulesNotEnabledByDefault: number = 0
  public mode: LinterMode = "cli"

  protected allAvailableRules: RuleClass[]
  protected herb: HerbBackend
  protected parseCache: ParseCache
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
    const configVersion = config?.configVersion
    const filterResult = Linter.filterRulesByConfig(allRules, config?.linter?.rules, configVersion)

    const linter = new Linter(herb, filterResult.enabled, config, allRules)
    linter.rulesSkippedByVersion = filterResult.skippedByVersion
    linter.rulesDisabledByConfig = filterResult.disabledByConfig
    linter.rulesNotEnabledByDefault = filterResult.notEnabledByDefault

    return linter
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
    this.parseCache = new ParseCache(herb)
    this.config = config
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.allAvailableRules = allAvailableRules !== undefined ? allAvailableRules : this.rules
    this.offenses = []
  }

  /**
   * Filters rules based on default config, user config overrides, and version gating.
   *
   * Priority:
   * 1. User explicitly enabled/disabled (if rule config exists in userRulesConfig)
   * 2. Version gating (if rule.introducedIn > configVersion, skip unless explicitly enabled)
   * 3. Default config from rule's defaultConfig getter
   *
   * @param allRules - All available rule classes to filter from
   * @param userRulesConfig - Optional user configuration for rules
   * @param configVersion - Optional version from the user's .herb.yml for version-gated filtering
   * @returns Object with enabled rules and rules skipped due to version gating
   */
  static filterRulesByConfig(
    allRules: RuleClass[],
    userRulesConfig?: Record<string, RuleConfig>,
    configVersion?: string
  ): FilterRulesResult {
    const enabled: RuleClass[] = []
    const skippedByVersion: VersionSkippedRule[] = []
    let disabledByConfig = 0
    let notEnabledByDefault = 0

    for (const ruleClass of allRules) {
      const instance = new ruleClass()
      const defaultEnabled = instance.defaultConfig?.enabled ?? DEFAULT_RULE_CONFIG.enabled
      const userRuleConfig = userRulesConfig?.[ruleClass.ruleName]

      if (userRuleConfig !== undefined) {
        if (userRuleConfig.enabled !== false) {
          enabled.push(ruleClass)
        } else {
          disabledByConfig++
        }

        continue
      }

      if (configVersion && ruleClass.introducedIn) {
        if (semverGreaterThan(ruleClass.introducedIn, configVersion)) {
          if (defaultEnabled) {
            skippedByVersion.push({
              ruleName: ruleClass.ruleName,
              introducedIn: ruleClass.introducedIn,
            })
          } else {
            notEnabledByDefault++
          }

          continue
        }
      }

      if (defaultEnabled) {
        enabled.push(ruleClass)
      } else {
        notEnabledByDefault++
      }
    }

    return { enabled, skippedByVersion, disabledByConfig, notEnabledByDefault }
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * These are the rules enabled when no custom rules are provided.
   * Filters all available rules to only include those enabled by default.
   * @returns Array of default rule classes
   */
  protected getDefaultRules(): RuleClass[] {
    return Linter.filterRulesByConfig(rules).enabled
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

  protected findRuleClass(ruleName: string): RuleClass | undefined {
    return this.rules.find(ruleClass => ruleClass.ruleName === ruleName)
  }

  /**
   * Type guard to check if a rule class is a LexerRule class
   */
  protected isLexerRuleClass(ruleClass: RuleClass): ruleClass is LexerRuleClass {
    return ruleClass.type === "lexer"
  }

  /**
   * Type guard to check if a rule class is a SourceRule class
   */
  protected isSourceRuleClass(ruleClass: RuleClass): ruleClass is SourceRuleClass {
    return ruleClass.type === "source"
  }

  /**
   * Type guard to check if a rule class is a ParserRule class
   */
  protected isParserRuleClass(ruleClass: RuleClass): ruleClass is ParserRuleClass {
    return ruleClass.type === "parser" || ruleClass.type === undefined
  }

  /**
   * Execute a single rule and return its unbound offenses.
   * Handles rule type checking (Lexer/Parser/Source) and isEnabled checks.
   */
  private executeRule(
    ruleClass: RuleClass,
    rule: Rule,
    parseResult: ParseResult,
    lexResult: LexResult,
    source: string,
    context?: Partial<LintContext>
  ): UnboundLintOffense[] {
    const ruleName = rule.ruleName

    if (this.config && context?.fileName) {
      if (!this.config.isRuleEnabledForPath(ruleName, context.fileName)) {
        return []
      }
    }

    if (context?.fileName && !this.config?.linter?.rules?.[ruleName]?.exclude) {
      const defaultExclude = rule.defaultConfig?.exclude ?? DEFAULT_RULE_CONFIG.exclude

      if (defaultExclude && defaultExclude.length > 0) {
        const isExcluded = defaultExclude.some(pattern => picomatch.isMatch(context.fileName!, pattern))

        if (isExcluded) {
          return []
        }
      }
    }

    let isEnabled = true
    let ruleOffenses: UnboundLintOffense[]

    if (this.isLexerRuleClass(ruleClass)) {
      const lexerRule = rule as LexerRule

      if (lexerRule.isEnabled) {
        isEnabled = lexerRule.isEnabled(lexResult, context)
      }

      if (isEnabled) {
        ruleOffenses = lexerRule.check(lexResult, context)
      } else {
        ruleOffenses = []
      }

    } else if (this.isSourceRuleClass(ruleClass)) {
      const sourceRule = rule as SourceRule

      if (sourceRule.isEnabled) {
        isEnabled = sourceRule.isEnabled(source, context)
      }

      if (isEnabled) {
        ruleOffenses = sourceRule.check(source, context)
      } else {
        ruleOffenses = []
      }
    } else {
      const parserRule = rule as ParserRule

      if (parserRule.isEnabled) {
        isEnabled = parserRule.isEnabled(parseResult, context)
      }

      if (isEnabled) {
        ruleOffenses = parserRule.check(parseResult, context)
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

    const parseResult = this.parseCache.get(source)

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
      const hasParserRule = this.findRuleClass("parser-no-errors")

      if (hasParserRule) {
        const rule = new ParserNoErrorsRule()
        const offenses = rule.check(parseResult)
        this.offenses.push(...offenses)
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
      validRuleNames: this.getAvailableRules().map(ruleClass => ruleClass.ruleName),
      ignoredOffensesByLine,
      indentWidth: context?.indentWidth ?? this.config?.formatter?.indentWidth
    }

    const regularRules = this.rules.filter(ruleClass => ruleClass.ruleName !== "herb-disable-comment-unnecessary")

    for (const ruleClass of regularRules) {
      const rule = new ruleClass()
      const parserOptions = this.isParserRuleClass(ruleClass) ? (rule as ParserRule).parserOptions : {}
      const parseResult = this.parseCache.get(source, parserOptions)

      // Skip parser rules whose parse result has errors (unless the rule consumes parser errors)
      // Skip lexer/source rules when the default parse has errors
      if (this.isParserRuleClass(ruleClass)) {
        if (parseResult.recursiveErrors().length > 0 && !ruleClass.consumesParserErrors) continue
      } else if (hasParserErrors) {
        continue
      }

      const unboundOffenses = this.executeRule(ruleClass, rule, parseResult, lexResult, source, context)
      const boundOffenses = this.bindSeverity(unboundOffenses, ruleClass.ruleName)

      const { kept, ignored, wouldBeIgnored } = this.filterOffenses(
        boundOffenses,
        ruleClass.ruleName,
        ignoredOffensesByLine,
        herbDisableCache,
        context?.ignoreDisableComments
      )

      ignoredCount += ignored.length
      wouldBeIgnoredCount += wouldBeIgnored.length
      this.offenses.push(...kept)
    }

    const unnecessaryRuleClass = this.findRuleClass("herb-disable-comment-unnecessary")

    if (unnecessaryRuleClass) {
      const unnecessaryRule = new unnecessaryRuleClass() as ParserRule
      const parseResult = this.parseCache.get(source, unnecessaryRule.parserOptions)
      const unboundOffenses = unnecessaryRule.check(parseResult, context)
      const boundOffenses = this.bindSeverity(unboundOffenses, unnecessaryRuleClass.ruleName)

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
    const ruleClass = this.findRuleClass(ruleName)

    if (!ruleClass) {
      return unboundOffenses.map(offense => ({
        ...offense,
        severity: "error" as const
      }))
    }

    const ruleInstance = new ruleClass()
    const defaultSeverityConfig = ruleInstance.defaultConfig?.severity ?? DEFAULT_RULE_CONFIG.severity

    const userRuleConfig = this.config?.linter?.rules?.[ruleName]
    const severityConfig = userRuleConfig?.severity ?? defaultSeverityConfig
    const severity = resolveSeverity(severityConfig, this.mode)

    return unboundOffenses.map(offense => ({
      ...offense,
      severity: offense.severity ?? severity
    }))
  }

  /**
   * Automatically fix offenses in the source code.
   * Uses AST mutation for parser rules and token mutation for lexer rules.
   * @param source - The source code to fix
   * @param context - Optional context for linting (e.g., fileName)
   * @param offensesToFix - Optional array of specific offenses to fix. If not provided, all fixable offenses will be fixed.
   * @param options - Options for autofix behavior
   * @param options.includeUnsafe - If true, also apply unsafe fixes (rules with unsafeAutocorrectable = true)
   * @returns AutofixResult containing the corrected source and lists of fixed/unfixed offenses
   */
  autofix(source: string, context?: Partial<LintContext>, offensesToFix?: LintOffense[], options?: { includeUnsafe?: boolean }): AutofixResult {
    const includeUnsafe = options?.includeUnsafe ?? false

    context = {
      ...context,
      indentWidth: context?.indentWidth ?? this.config?.formatter?.indentWidth
    }

    const lintResult = offensesToFix ? { offenses: offensesToFix } : this.lint(source, context)

    const parserOffenses: LintOffense[] = []
    const lexerOffenses: LintOffense[] = []
    const sourceOffenses: LintOffense[] = []

    for (const offense of lintResult.offenses) {
      const ruleClass = this.findRuleClass(offense.rule)

      if (!ruleClass) continue

      if (this.isLexerRuleClass(ruleClass)) {
        lexerOffenses.push(offense)
      } else if (this.isSourceRuleClass(ruleClass)) {
        sourceOffenses.push(offense)
      } else {
        parserOffenses.push(offense)
      }
    }

    let currentSource = source
    const fixed: LintOffense[] = []
    const unfixed: LintOffense[] = []

    if (parserOffenses.length > 0) {
      let needsReindent = false
      let lastParseResult: ParseResult | null = null

      for (const offense of parserOffenses) {
        const ruleClass = this.findRuleClass(offense.rule)

        if (!ruleClass) {
          unfixed.push(offense)

          continue
        }

        const rule = new ruleClass() as ParserRule
        const isUnsafe = (ruleClass as any).unsafeAutocorrectable === true || offense.autofixContext?.unsafe === true

        if (!rule.autofix) {
          unfixed.push(offense)

          continue
        }

        if (isUnsafe && !includeUnsafe) {
          unfixed.push(offense)

          continue
        }

        const parserOptions = rule.parserOptions || {}
        const parseResult = this.parseCache.get(currentSource, parserOptions)

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
          lastParseResult = parseResult

          if (this.isParserRuleClass(ruleClass) && ruleClass.reindentAfterAutofix === true) {
            needsReindent = true
          }
        } else {
          unfixed.push(offense)
        }
      }

      if (fixed.length > 0 && lastParseResult) {
        if (needsReindent) {
          currentSource = new IndentPrinter().print(lastParseResult.value)
        } else {
          currentSource = new IdentityPrinter().print(lastParseResult.value)
        }
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
        const ruleClass = this.findRuleClass(offense.rule)

        if (!ruleClass) {
          unfixed.push(offense)
          continue
        }

        const rule = new ruleClass() as SourceRule
        const isUnsafe = (ruleClass as any).unsafeAutocorrectable === true || offense.autofixContext?.unsafe === true

        if (!rule.autofix) {
          unfixed.push(offense)
          continue
        }

        if (isUnsafe && !includeUnsafe) {
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

  previewAutofix(source: string, context?: Partial<LintContext>, offensesToFix?: LintOffense[], options?: { includeUnsafe?: boolean }): AutofixResult {
    this.parseCache.clear()

    const result = this.autofix(source, context, offensesToFix, options)

    this.parseCache.clear()

    return result
  }
}
