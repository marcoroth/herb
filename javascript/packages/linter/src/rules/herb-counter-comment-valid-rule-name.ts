import { ParserRule } from "../types.js"
import { HerbCounterCommentParsedVisitor } from "./herb-counter-comment-base.js"

import { didyoumean } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbCounterComment } from "../herb-counter-comment-utils.js"

class HerbCounterCommentValidRuleNameVisitor extends HerbCounterCommentParsedVisitor {
  private validRuleNames: Set<string>

  constructor(
    ruleName: string,
    validRuleNames: string[],
    context?: Partial<LintContext>,
  ) {
    super(ruleName, context)

    this.validRuleNames = new Set(validRuleNames)
  }

  protected checkParsedHerbCounter(node: ERBContentNode, _content: string, herbCounter: HerbCounterComment): void {
    const { ruleName, ruleNameOffset, ruleNameLength } = herbCounter

    if (this.validRuleNames.has(ruleName)) return

    const location = this.createSpanLocation(node, ruleNameOffset, ruleNameLength)
    const suggestion = didyoumean(ruleName, Array.from(this.validRuleNames))
    const message = suggestion
      ? `Unknown rule \`${ruleName}\` in \`herb:counter\` comment. Did you mean \`${suggestion}\`?`
      : `Unknown rule \`${ruleName}\` in \`herb:counter\` comment.`

    this.addOffenseWithFallback(message, location, node)
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

    const visitor = new HerbCounterCommentValidRuleNameVisitor(
      this.ruleName,
      validRuleNames,
      context,
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
