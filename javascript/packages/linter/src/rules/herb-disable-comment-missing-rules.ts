import { ParserRule } from "../types.js"
import { HerbDisableCommentBaseVisitor } from "./herb-disable-comment-base.js"

import { HERB_DISABLE_DIRECTIVE_KEY } from "../herb-disable-comment-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HerbDirectiveNode, ParseResult } from "@herb-tools/core"

class HerbDisableCommentMissingRulesVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: HerbDirectiveNode, _content: string): void {
    if (node.key?.value !== HERB_DISABLE_DIRECTIVE_KEY) return
    if (node.arguments) return

    this.addOffense(
      `\`herb:disable\` comment is missing rule names. Specify \`all\` or list specific rules to disable.`,
      node.location,
    )
  }
}

export class HerbDisableCommentMissingRulesRule extends ParserRule {
  static ruleName = "herb-disable-comment-missing-rules"
  static introducedIn = this.version("0.8.0")
  static defaultEnabledIn = this.version("0.8.0")

  get parserOptions() {
    return {
      herb_directives: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentMissingRulesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
