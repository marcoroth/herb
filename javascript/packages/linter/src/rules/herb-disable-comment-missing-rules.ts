import { ParserRule } from "../types.js"
import { HerbDisableCommentBaseVisitor } from "./herb-disable-comment-base.js"

import { parseHerbDisableContent } from "../herb-disable-comment-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

class HerbDisableCommentMissingRulesVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: ERBContentNode, content: string): void {
    const herbDisable = parseHerbDisableContent(content)
    if (herbDisable) return

    const emptyFormat = /^\s*herb:disable\s*$/
    if (!emptyFormat.test(content)) return

    this.addOffense(
      `\`herb:disable\` comment is missing rule names. Specify \`all\` or list specific rules to disable.`,
      node.location,
    )
  }
}

export class HerbDisableCommentMissingRulesRule extends ParserRule {
  name = "herb-disable-comment-missing-rules"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentMissingRulesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
