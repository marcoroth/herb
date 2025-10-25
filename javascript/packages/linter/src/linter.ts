import { Location } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import { defaultRules } from "./default-rules.js"
import { findNodeByLocation } from "./rules/rule-utils.js"
import { parseHerbDisableLine } from "./herb-disable-comment-utils.js"

import type { RuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense, LintContext, AutofixResult } from "./types.js"
import type { ParseResult, LexResult, HerbBackend } from "@herb-tools/core"

export class Linter {
  protected rules: RuleClass[]
  protected herb: HerbBackend
  protected offenses: LintOffense[]

  /**
   * Creates a new Linter instance.
   * @param herb - The Herb backend instance for parsing and lexing
   * @param rules - Array of rule classes (Parser/AST or Lexer) to use. If not provided, uses default rules.
   */
  constructor(herb: HerbBackend, rules?: RuleClass[]) {
    this.herb = herb
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.offenses = []
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * These are the rules enabled when no custom rules are provided.
   * @returns Array of default rule classes
   */
  protected getDefaultRules(): RuleClass[] {
    return defaultRules
  }

  /**
   * Returns all available rule classes that can be referenced in herb:disable comments.
   * This includes all rules that exist, regardless of whether they're currently enabled.
   * @returns Array of all available rule classes
   */
  protected getAvailableRules(): RuleClass[] {
    return defaultRules
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
   * Execute a single rule and return its offenses.
   * Handles rule type checking (Lexer/Parser/Source) and isEnabled checks.
   */
  private executeRule(
    rule: Rule,
    parseResult: ParseResult,
    lexResult: LexResult,
    source: string,
    hasParserErrors: boolean,
    context?: Partial<LintContext>
  ): LintOffense[] {
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
      if (hasParserErrors && rule.name !== "parser-no-errors") {
        return []
      }

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
    const lexResult = this.herb.lex(source)
    const hasParserErrors = parseResult.recursiveErrors().length > 0
    const sourceLines = source.split("\n")
    const ignoredOffensesByLine = new Map<number, Set<string>>()
    const herbDisableCache = new Map<number, string[]>()

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
      const ruleOffenses = this.executeRule(rule, parseResult, lexResult, source, hasParserErrors, context)

      const { kept, ignored, wouldBeIgnored } = this.filterOffenses(
        ruleOffenses,
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
      const ruleOffenses = unnecessaryRule.check(parseResult, context)

      this.offenses.push(...ruleOffenses)
    }

    const errors = this.offenses.filter(offense => offense.severity === "error").length
    const warnings = this.offenses.filter(offense => offense.severity === "warning").length

    const result: LintResult = {
      offenses: this.offenses,
      errors,
      warnings,
      ignored: ignoredCount
    }

    if (wouldBeIgnoredCount > 0) {
      result.wouldBeIgnored = wouldBeIgnoredCount
    }

    return result
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
