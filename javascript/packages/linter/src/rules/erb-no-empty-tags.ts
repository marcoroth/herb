import { BaseRuleVisitor } from "./rule-utils.js"

import type { Rule, LintOffense } from "../types.js"
import type { Node, ERBContentNode } from "@herb-tools/core"

class ERBNoEmptyTagsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    this.visitChildNodes(node)

    if (!node.content) return
    if (node.content.value.trim().length > 0) return

    this.addOffense(
      "ERB tag should not be empty. Remove empty ERB tags or add content.",
      node.location,
      "error"
    )
  }
}

export class ERBNoEmptyTagsRule implements Rule {
  name = "erb-no-empty-tags"

  check(node: Node): LintOffense[] {
    const visitor = new ERBNoEmptyTagsVisitor(this.name)

    visitor.visit(node)

    return visitor.offenses
  }
}
