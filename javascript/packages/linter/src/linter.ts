import { defaultRules } from "./default-rules.js"

import type { RuleClass, Rule, ParserRule, LexerRule, SourceRule, LintResult, LintOffense } from "./types.js"
import type { HerbBackend } from "@herb-tools/core"

export class Linter {
  private rules: RuleClass[]
  private herb: HerbBackend
  private offenses: LintOffense[]

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
   * @returns Array of rule classes
   */
  private getDefaultRules(): RuleClass[] {
    return defaultRules
  }

  getRuleCount(): number {
    return this.rules.length
  }

  /**
   * Type guard to check if a rule is a LexerRule
   */
  private isLexerRule(rule: Rule): rule is LexerRule {
    return (rule.constructor as any).type === "lexer"
  }

  /**
   * Type guard to check if a rule is a SourceRule
   */
  private isSourceRule(rule: Rule): rule is SourceRule {
    return (rule.constructor as any).type === "source"
  }

  /**
   * Lint source code using Parser/AST, Lexer, and Source rules.
   * @param source - The source code to lint
   */
  lint(source: string): LintResult {
    this.offenses = []

    const parseResult = this.herb.parse(source)
    const lexResult = this.herb.lex(source)

    for (const RuleClass of this.rules) {
      const rule = new RuleClass()

      let ruleOffenses: LintOffense[]

      if (this.isLexerRule(rule)) {
        ruleOffenses = (rule as LexerRule).check(lexResult)
      } else if (this.isSourceRule(rule)) {
        ruleOffenses = (rule as SourceRule).check(source)
      } else {
        ruleOffenses = (rule as ParserRule).check(parseResult.value)
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
