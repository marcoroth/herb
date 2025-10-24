import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentNoRedundantAllVisitor extends HerbDisableCommentParsedVisitor {
  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    if (!herbDisable.ruleNames.includes("all")) return
    if (herbDisable.ruleNames.length <= 1) return

    const allDetail = herbDisable.ruleNameDetails.find(detail => detail.name === "all")
    if (!allDetail) return

    const location = this.createRuleNameLocation(node, allDetail)
    const message = `Using \`all\` with specific rules is redundant. Use \`herb:disable all\` by itself or list only specific rules.`

    this.addOffenseWithFallback(message, location, node, "warning")
  }
}

export class HerbDisableCommentNoRedundantAllRule extends ParserRule {
  name = "herb-disable-comment-no-redundant-all"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HerbDisableCommentNoRedundantAllVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
