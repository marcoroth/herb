import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
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

    this.addOffenseWithFallback(message, location, node)
  }
}

export class HerbDisableCommentNoRedundantAllRule extends ParserRule {
  static ruleName = "herb-disable-comment-no-redundant-all"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentNoRedundantAllVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
