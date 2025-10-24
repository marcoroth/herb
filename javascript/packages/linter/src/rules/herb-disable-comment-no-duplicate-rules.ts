import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { LintOffense, LintContext } from "../types.js"
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

        this.addOffenseWithFallback(message, location, node, "warning")

        return
      }

      seenRules.set(ruleDetail.name, index)
    })
  }
}

export class HerbDisableCommentNoDuplicateRulesRule extends ParserRule {
  name = "herb-disable-comment-no-duplicate-rules"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HerbDisableCommentNoDuplicateRulesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
