import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isHTMLTextNode, isERBIfNode, isERBElseNode, Location } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type {
  Node,
  ERBIfNode,
  ERBElseNode,
  ERBUnlessNode,
  ERBForNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBWhenNode,
  ERBBeginNode,
  ERBRescueNode,
  ERBEnsureNode,
  ERBBlockNode,
  ERBInNode,
  ParseResult,
} from "@herb-tools/core"

class ERBNoEmptyControlFlowVisitor extends BaseRuleVisitor {
  private processedIfNodes: Set<ERBIfNode> = new Set()
  private processedElseNodes: Set<ERBElseNode> = new Set()

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      return
    }

    this.markIfChainAsProcessed(node)
    this.markElseNodesInIfChain(node)

    const entireChainEmpty = this.isEntireIfChainEmpty(node)

    if (entireChainEmpty) {
      this.addEmptyBlockOffense(node, node.statements, "if")
    } else {
      this.checkIfChainParts(node)
    }

    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    if (this.processedElseNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.addEmptyBlockOffense(node, node.statements, "else")
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const unlessHasContent = this.statementsHaveContent(node.statements)
    const elseHasContent = node.else_clause && this.statementsHaveContent(node.else_clause.statements)

    if (node.else_clause) {
      this.processedElseNodes.add(node.else_clause)
    }

    const entireBlockEmpty = !unlessHasContent && !elseHasContent

    if (entireBlockEmpty) {
      this.addEmptyBlockOffense(node, node.statements, "unless")
    } else {
      if (!unlessHasContent) {
        this.addEmptyBlockOffenseWithEnd(node, node.statements, "unless", node.else_clause)
      }

      if (node.else_clause && !elseHasContent) {
        this.addEmptyBlockOffense(node.else_clause, node.else_clause.statements, "else")
      }
    }

    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.addEmptyBlockOffense(node, node.statements, "for")
    this.visitChildNodes(node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.addEmptyBlockOffense(node, node.statements, "while")
    this.visitChildNodes(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.addEmptyBlockOffense(node, node.statements, "until")
    this.visitChildNodes(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    if (!node.then_keyword) {
      this.addEmptyBlockOffense(node, node.statements, "when")
    }

    this.visitChildNodes(node)
  }

  visitERBInNode(node: ERBInNode): void {
    if (!node.then_keyword) {
      this.addEmptyBlockOffense(node, node.statements, "in")
    }

    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.addEmptyBlockOffense(node, node.statements, "begin")
    this.visitChildNodes(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.addEmptyBlockOffense(node, node.statements, "rescue")
    this.visitChildNodes(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.addEmptyBlockOffense(node, node.statements, "ensure")
    this.visitChildNodes(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.addEmptyBlockOffense(node, node.body, "do")
    this.visitChildNodes(node)
  }

  private addEmptyBlockOffense(node: Node, statements: Node[], blockType: string): void {
    this.addEmptyBlockOffenseWithEnd(node, statements, blockType, null)
  }

  private addEmptyBlockOffenseWithEnd(node: Node, statements: Node[], blockType: string, subsequentNode: Node | null): void {
    if (this.statementsHaveContent(statements)) {
      return
    }

    const startLocation = node.location.start
    const endLocation = subsequentNode
      ? subsequentNode.location.start
      : node.location.end

    const location = Location.from(
      startLocation.line, startLocation.column,
      endLocation.line, endLocation.column,
    )

    const offense = this.createOffense(
      `Empty ${blockType} block: this control flow statement has no content`,
      location,
    )
    offense.tags = ["unnecessary"]
    this.offenses.push(offense)
  }

  private statementsHaveContent(statements: Node[]): boolean {
    return statements.some(statement => {
      if (isHTMLTextNode(statement)) {
        return statement.content.trim() !== ""
      }

      return true
    })
  }

  private markIfChainAsProcessed(node: ERBIfNode): void {
    this.processedIfNodes.add(node)
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (isERBIfNode(current)) {
        this.processedIfNodes.add(current)
      }
    })
  }

  private markElseNodesInIfChain(node: ERBIfNode): void {
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (isERBElseNode(current)) {
        this.processedElseNodes.add(current)
      }
    })
  }

  private traverseSubsequentNodes(startNode: Node | null, callback: (node: ERBIfNode | ERBElseNode) => void): void {
    let current: Node | null = startNode
    while (current) {
      if (isERBIfNode(current)) {
        callback(current)
        current = current.subsequent
      } else if (isERBElseNode(current)) {
        callback(current)
        break
      } else {
        break
      }
    }
  }

  private checkIfChainParts(node: ERBIfNode): void {
    if (!this.statementsHaveContent(node.statements)) {
      this.addEmptyBlockOffenseWithEnd(node, node.statements, "if", node.subsequent)
    }

    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (this.statementsHaveContent(current.statements)) {
        return
      }

      const blockType = isERBIfNode(current) ? "elsif" : "else"
      const nextSubsequent = isERBIfNode(current) ? current.subsequent : null

      if (nextSubsequent) {
        this.addEmptyBlockOffenseWithEnd(current, current.statements, blockType, nextSubsequent)
      } else {
        this.addEmptyBlockOffense(current, current.statements, blockType)
      }
    })
  }

  private isEntireIfChainEmpty(node: ERBIfNode): boolean {
    if (this.statementsHaveContent(node.statements)) {
      return false
    }

    let hasContent = false
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (this.statementsHaveContent(current.statements)) {
        hasContent = true
      }
    })

    return !hasContent
  }
}

export class ERBNoEmptyControlFlowRule extends ParserRule {
  static ruleName = "erb-no-empty-control-flow"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "hint"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoEmptyControlFlowVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
