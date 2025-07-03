import { BaseRuleVisitor } from "./rule-utils.js"

import type { Node, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBEndNode } from "@herb-tools/core"
import type { Rule, LintOffense } from "../types.js"

class NoOutputControlFlow extends BaseRuleVisitor {
  visitERBIfNode(node: ERBIfNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  private checkOutputControlFlow(controlBlock: ERBIfNode | ERBUnlessNode | ERBElseNode | ERBEndNode): void {
    const openTag = controlBlock.tag_opening;
    if (!openTag) {
      return
    }

    if (openTag.value === "<%="){
      this.addOffense(
        `Control flow statements like \`${controlBlock.type}\`
        should not be used with output tags. Use \`<% ${controlBlock.type} ... %>\` instead.`,
        openTag.location,
        "error"
      )
    }

    return
  }

}

export class ERBNoOutputControlFlow implements Rule {
  name = "erb-no-output-control-flow"
  check(node: Node): LintOffense[] {
    const visitor = new NoOutputControlFlow(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
