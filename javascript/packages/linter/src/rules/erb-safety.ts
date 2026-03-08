import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { filterERBContentNodes, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLOpenTagNode, HTMLAttributeNameNode } from "@herb-tools/core"

class ERBSafetyVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagSafety(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    this.checkAttributeNameSafety(node)
    super.visitHTMLAttributeNameNode(node)
  }

  private checkTagSafety(node: HTMLOpenTagNode): void {
    const erbNodes = filterERBContentNodes(node.children)
    const outputNodes = erbNodes.filter(isERBOutputNode)

    for (const erbNode of outputNodes) {
      this.addOffense(
        "ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.",
        erbNode.location,
      )
    }
  }

  private checkAttributeNameSafety(node: HTMLAttributeNameNode): void {
    const erbNodes = filterERBContentNodes(node.children)
    const outputNodes = erbNodes.filter(isERBOutputNode)

    for (const erbNode of outputNodes) {
      this.addOffense(
        "ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.",
        erbNode.location,
      )
    }
  }
}

export class ERBSafetyRule extends ParserRule {
  static ruleName = "erb-safety"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBSafetyVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
