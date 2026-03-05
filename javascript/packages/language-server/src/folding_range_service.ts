import { FoldingRange, FoldingRangeKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { ParserService } from "./parser_service"

import { isERBIfNode } from "@herb-tools/core"
import { lspLine } from "./range_utils"

import type {
  Node,
  ERBNode,
  ERBContentNode,
  HTMLElementNode,
  HTMLOpenTagNode,
  HTMLAttributeValueNode,
  HTMLCommentNode,
  HTMLConditionalElementNode,
  CDATANode,
  ERBIfNode,
  ERBUnlessNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBBeginNode,
  SerializedPosition,
} from "@herb-tools/core"

export class FoldingRangeService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getFoldingRanges(textDocument: TextDocument): FoldingRange[] {
    const parseResult = this.parserService.parseDocument(textDocument)
    const collector = new FoldingRangeCollector()

    collector.visit(parseResult.document)

    return collector.ranges
  }
}

export class FoldingRangeCollector extends Visitor {
  public ranges: FoldingRange[] = []
  private processedIfNodes: Set<ERBIfNode> = new Set()

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.addRangeForNode(node, node.body)
    this.visitChildNodes(node)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.addRangeForNode(node, node.children)
    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    this.addRange(node.location.start, node.location.end, FoldingRangeKind.Comment)
    this.visitChildNodes(node)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    this.addRangeForNode(node, node.children)
    this.visitChildNodes(node)
  }

  visitCDATANode(node: CDATANode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitHTMLConditionalElementNode(node: HTMLConditionalElementNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBNode(node: ERBNode): void {
    this.addRange(node.location.start, node.location.end)
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.markIfChainAsProcessed(node)
    this.addRange(node.location.start, node.location.end)

    if (node.statements.length > 0) {
      const firstStatement = node.statements[0]
      const lastStatement = node.statements[node.statements.length - 1]

      this.addRange(firstStatement.location.start, lastStatement.location.end)
    }

    let current: Node | null = node.subsequent

    while (current) {
      if (isERBIfNode(current)) {
        if (current.statements.length > 0) {
          const firstStatement = current.statements[0]
          const lastStatement = current.statements[current.statements.length - 1]
          this.addRange(firstStatement.location.start, lastStatement.location.end)
        }

        current = current.subsequent
      } else {
        break
      }
    }

    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  private markIfChainAsProcessed(node: ERBIfNode): void {
    this.processedIfNodes.add(node)

    let current: Node | null = node.subsequent

    while (current) {
      if (isERBIfNode(current)) {
        this.processedIfNodes.add(current)
        current = current.subsequent
      } else {
        break
      }
    }
  }

  private addRange(start: SerializedPosition, end: SerializedPosition, kind?: FoldingRangeKind): void {
    const startLine = lspLine(start)
    const endLine = lspLine(end)

    if (endLine > startLine) {
      this.ranges.push({ startLine, endLine, kind })
    }
  }

  private addRangeForNode(node: Node, children: Node[]) {
    if (children.length > 0) {
      this.addRange(node.location.start, node.location.end)
    }
  }
}
