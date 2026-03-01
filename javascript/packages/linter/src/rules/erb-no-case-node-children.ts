import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isWhitespaceNode, isLiteralNode, isHTMLTextNode, isCommentNode, isERBNode } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBCaseNode, ERBCaseMatchNode, Node } from "@herb-tools/core"

class ERBNoCaseNodeChildrenVisitor extends BaseRuleVisitor {
  visitERBCaseNode(node: ERBCaseNode): void {
    this.checkCaseNodeChildren(node, "when")
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.checkCaseNodeChildren(node, "in")
    this.visitChildNodes(node)
  }

  private checkCaseNodeChildren(node: ERBCaseNode | ERBCaseMatchNode, type: string): void {
    if (!node.children || node.children.length === 0) return

    const caseCode = IdentityPrinter.printERBNode(node)
    const firstCondition = node.conditions?.[0]
    const conditionCode = firstCondition && isERBNode(firstCondition) ? IdentityPrinter.printERBNode(firstCondition) : `<% ${type} ... %>`

    for (const child of node.children) {
      if (!this.isAllowedContent(child)) {
        const childCode = IdentityPrinter.print(child).trim()

        this.addOffense(
          `Do not place \`${childCode}\` between \`${caseCode}\` and \`${conditionCode}\`. Content here is not part of any branch and will not be rendered.`,
          child.location,
        )
      }
    }
  }

  private isAllowedContent(node: Node): boolean {
    if (isWhitespaceNode(node)) return true
    if (isCommentNode(node)) return true

    if (isLiteralNode(node) || isHTMLTextNode(node)) {
      return /^\s*$/.test(node.content)
    }

    return false
  }
}

export class ERBNoCaseNodeChildrenRule extends ParserRule {
  name = "erb-no-case-node-children"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoCaseNodeChildrenVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
