import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node"
import { Visitor } from "@herb-tools/core"

import type {
  Node,
  HTMLElementNode,
  HTMLOpenTagNode,
  HTMLAttributeValueNode,
  HTMLCommentNode,
  ERBIfNode,
  ERBElseNode,
  ERBUnlessNode,
  ERBBlockNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBForNode,
  ERBBeginNode,
  DocumentNode,
} from "@herb-tools/core"

export class FoldingRangeService {
  getFoldingRanges(document: DocumentNode): FoldingRange[] {
    const collector = new FoldingRangeCollector()

    collector.visit(document)

    return collector.ranges
  }
}

/**
 * Visitor that collects foldable ranges from the AST
 */
class FoldingRangeCollector extends Visitor {
  ranges: FoldingRange[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.addRangeForNode(node, node.body)
    this.visitChildNodes(node)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.addRangeForNode(node, node.children)
    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    const startLine = this.toZeroBased(node.location.start.line)
    const endLine = this.toZeroBased(node.location.end.line)

    this.addRange(startLine, endLine, FoldingRangeKind.Comment)

    this.visitChildNodes(node)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    this.addRangeForNode(node, node.children)
    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    const startLine = this.toZeroBased(node.location.start.line)
    const endLine = this.toZeroBased(node.location.end.line)

    this.addRange(startLine, endLine)

    if (node.statements.length > 0) {
      const firstStatement = node.statements[0]
      const lastStatement = node.statements[node.statements.length - 1]

      const startLine = this.toZeroBased(firstStatement.location.start.line)
      const endLine = this.toZeroBased(lastStatement.location.end.line)

      this.addRange(startLine, endLine)
    }

    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.addRangeForNode(node, node.body)
    this.visitChildNodes(node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.addRangeForNode(node, node.statements)
    this.visitChildNodes(node)
  }

  // TODO: consider adding `startCharacter` and `endCharacter`
  private addRange(startLine: number, endLine: number, kind?: FoldingRangeKind): void {
    if (endLine > startLine) {
      this.ranges.push({
        startLine,
        endLine,
        kind,
      })
    }
  }

  private addRangeForNode(node: Node, children: Node[]) {
    if (children.length > 0) {
      const startLine = this.toZeroBased(node.location.start.line)
      const endLine = this.toZeroBased(node.location.end.line)

      this.addRange(startLine, endLine)
    }
  }

  private toZeroBased(line: number): number {
    return line - 1
  }
}
