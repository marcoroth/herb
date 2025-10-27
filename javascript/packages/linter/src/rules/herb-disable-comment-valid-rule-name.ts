import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import { didyoumean } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentValidRuleNameVisitor extends HerbDisableCommentParsedVisitor {
  private validRuleNames: Set<string> = new Set()
  private validRuleNamesList: string[] = []

  constructor(ruleName: string, validRuleNames: string[], context?: Partial<LintContext>) {
    super(ruleName, context)

    this.validRuleNames = new Set([...validRuleNames, "all"])
    this.validRuleNamesList = Array.from(this.validRuleNames)
  }

  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    herbDisable.ruleNameDetails.forEach(ruleDetail => {
      if (this.validRuleNames.has(ruleDetail.name)) return

      const suggestion = didyoumean(ruleDetail.name, this.validRuleNamesList)
      const message = suggestion
        ? `Unknown rule \`${ruleDetail.name}\`. Did you mean \`${suggestion}\`?`
        : `Unknown rule \`${ruleDetail.name}\`.`

      const location = this.createRuleNameLocation(node, ruleDetail)
      this.addOffenseWithFallback(message, location, node)
    })
  }
}

export class HerbDisableCommentValidRuleNameRule extends ParserRule {
  name = "herb-disable-comment-valid-rule-name"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const validRuleNames = context?.validRuleNames

    if (!validRuleNames) return []
    if (validRuleNames.length === 0) return []

    const visitor = new HerbDisableCommentValidRuleNameVisitor(
      this.name,
      validRuleNames,
      context
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
