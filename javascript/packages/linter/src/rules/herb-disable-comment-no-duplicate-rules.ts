import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentNoDuplicateRulesVisitor extends HerbDisableCommentParsedVisitor {
  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    const seenRules = new Map<string, number>()

    herbDisable.ruleNameDetails.forEach((ruleDetail, index) => {
      const firstIndex = seenRules.get(ruleDetail.name)

      if (firstIndex !== undefined) {
        const location = this.createRuleNameLocation(node, ruleDetail)
        const message = `Duplicate rule \`${ruleDetail.name}\` in \`herb:disable\` comment. Remove the duplicate.`

        this.addOffenseWithFallback(message, location, node)

        return
      }

      seenRules.set(ruleDetail.name, index)
    })
  }
}

export class HerbDisableCommentNoDuplicateRulesRule extends ParserRule {
  name = "herb-disable-comment-no-duplicate-rules"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentNoDuplicateRulesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
