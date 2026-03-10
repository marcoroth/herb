import { BaseRuleVisitor } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

class ERBNoEmptyTagsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    this.visitChildNodes(node)

    const { content, tag_closing } = node

    if (!content) return
    if (tag_closing?.value === "") return
    if (content.value.trim().length > 0) return

    this.addOffense(
      "ERB tag should not be empty. Remove empty ERB tags or add content.",
      node.location,
      "error"
    )
  }
}

export class ERBNoEmptyTagsRule extends ParserRule {
  name = "erb-no-empty-tags"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBNoEmptyTagsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
