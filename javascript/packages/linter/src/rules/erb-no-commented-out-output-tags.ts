import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, ERBNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const COMMENTED_OUT_OUTPUT_TAG = /^[ \t]*(={1,2})(?!=)/

class ERBNoCommentedOutOutputTagsVisitor extends BaseRuleVisitor {

  visitERBNode(node: ERBNode): void {
    const openTag = node.tag_opening
    const { value } = node.content ?? {}

    if (!openTag || !value) return
    if (openTag.value !== "<%#") return

    const match = value.match(COMMENTED_OUT_OUTPUT_TAG)

    if (!match) return

    const commentedTag = `<%#${match[0]}`
    const originalTag = `<%${match[1]}`

    this.addOffense(
      `\`${commentedTag}\` looks like a temporarily commented ERB output tag. Remove it, or restore it to \`${originalTag}\` if it's still needed.`,
      openTag.location,
    )
  }
}

export class ERBNoCommentedOutOutputTagsRule extends ParserRule {
  static ruleName = "erb-no-commented-out-output-tags"
  static introducedIn = this.version("0.10.3")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoCommentedOutOutputTagsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
