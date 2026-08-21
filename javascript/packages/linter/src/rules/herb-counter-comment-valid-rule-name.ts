import { ParserRule } from "../types.js"
import { HerbCounterCommentParsedVisitor } from "./herb-counter-comment-base.js"

import { didyoumean } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbCounterComment } from "../herb-counter-comment-utils.js"

class HerbCounterCommentValidRuleNameVisitor extends HerbCounterCommentParsedVisitor {
  private validRuleNames: Set<string>
  private counterEnabledRules: Set<string>
  private counterEnabledList: string[]

  constructor(
    ruleName: string,
    validRuleNames: string[],
    counterEnabledRules: Set<string>,
    context?: Partial<LintContext>,
  ) {
    super(ruleName, context)

    this.validRuleNames = new Set(validRuleNames)
    this.counterEnabledRules = counterEnabledRules
    this.counterEnabledList = Array.from(counterEnabledRules)
  }

  protected checkParsedHerbCounter(node: ERBContentNode, _content: string, herbCounter: HerbCounterComment): void {
    const { ruleName, ruleNameOffset, ruleNameLength } = herbCounter
    const location = this.createSpanLocation(node, ruleNameOffset, ruleNameLength)

    if (!this.validRuleNames.has(ruleName)) {
      const suggestion = didyoumean(ruleName, Array.from(this.validRuleNames))
      const message = suggestion
        ? `Unknown rule \`${ruleName}\` in \`herb:counter\` comment. Did you mean \`${suggestion}\`?`
        : `Unknown rule \`${ruleName}\` in \`herb:counter\` comment.`

      this.addOffenseWithFallback(message, location, node)
      return
    }

    if (!this.counterEnabledRules.has(ruleName)) {
      const suggestion = this.counterEnabledList.length > 0
        ? didyoumean(ruleName, this.counterEnabledList)
        : undefined

      const base = `Rule \`${ruleName}\` does not have \`counter: true\` in the config. \`herb:counter\` is opt-in per rule.`
      const message = suggestion && suggestion !== ruleName
        ? `${base} Did you mean \`${suggestion}\`?`
        : base

      this.addOffenseWithFallback(message, location, node)
    }
  }
}

export class HerbCounterCommentValidRuleNameRule extends ParserRule {
  static ruleName = "herb-counter-comment-valid-rule-name"
  static introducedIn = this.version("0.10.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const validRuleNames = context?.validRuleNames
    if (!validRuleNames || validRuleNames.length === 0) return []

    const counterEnabledRules = context?.counterEnabledRules ?? new Set<string>()

    const visitor = new HerbCounterCommentValidRuleNameVisitor(
      this.ruleName,
      validRuleNames,
      counterEnabledRules,
      context,
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
