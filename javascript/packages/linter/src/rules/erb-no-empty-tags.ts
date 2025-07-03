import { BaseRuleVisitor } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { Node, ERBContentNode } from "@herb-tools/core"

class ERBNoEmptyTagsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    this.visitChildNodes(node)

    if (!node.content) return
    if (node.content.value.trim().length > 0) return

    this.addMessage(
      "ERB tag should not be empty. Remove empty ERB tags or add content.",
      node.location,
      "error"
    )
  }
}

export class ERBNoEmptyTagsRule implements Rule {
  name = "erb-no-empty-tags"

  check(node: Node): LintMessage[] {
    const visitor = new ERBNoEmptyTagsVisitor(this.name)

    visitor.visit(node)

    return visitor.messages
  }
}
