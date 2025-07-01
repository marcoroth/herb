import { Visitor } from "@herb-tools/core"

import type { Node, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBEndNode } from "@herb-tools/core"
import type { Rule, LintMessage } from "../types.js"


class NoOutputControlFlow extends Visitor {
  private ruleName: string
  private messages: LintMessage[] = []

  constructor(ruleName: string) {
    super()
    this.ruleName = ruleName
  }
  
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
  
  getMessages(): LintMessage[] {
    return this.messages
  }

  private checkOutputControlFlow(controlBlock: ERBIfNode | ERBUnlessNode | ERBElseNode | ERBEndNode): void {
    const openTag = controlBlock.tag_opening;
    if (!openTag) {
      return
    }
    if (openTag.value === "<%="){
      this.messages.push({
        rule: this.ruleName,
        message: `Control flow statements like \`${controlBlock.type}\` should not be used with output tags. Use \`<% ${controlBlock.type} ... %>\` instead.`,
        location: openTag.location,
        severity: "error"
      })
    }
    return
  }

}

export class ErbNoOutputControlFlow implements Rule {
  name = "erb-no-output-control-flow"
  description = "Prevent block-level elements from being placed inside inline elements"

  check(node: Node): LintMessage[] {
    const visitor = new NoOutputControlFlow(this.name)
    visitor.visit(node)
    return visitor.getMessages()
  }
}