import { DocumentHighlight, DocumentHighlightKind, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { ParserService } from "./parser_service"

import { isERBIfNode, isERBElseNode, isHTMLOpenTagNode } from "@herb-tools/core"
import { erbTagToRange, tokenToRange, nodeToRange, openTagRanges, isPositionInRange, rangeSize } from "./range_utils"

import type {
  Node,
  ERBNode,
  ERBContentNode,
  HTMLElementNode,
  HTMLConditionalElementNode,
  HTMLAttributeNode,
  HTMLCommentNode,
  ERBIfNode,
  ERBUnlessNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBBeginNode,
  ERBRescueNode,
} from "@herb-tools/core"

export class DocumentHighlightCollector extends Visitor {
  public groups: Range[][] = []
  private processedIfNodes: Set<ERBIfNode> = new Set()

  visitERBNode(node: ERBNode): void {
    if ('end_node' in node && node.end_node) {
      this.addGroup([erbTagToRange(node), erbTagToRange(node.end_node)])
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.addGroup([tokenToRange(node.tag_opening), tokenToRange(node.tag_closing)])
    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    this.addGroup([tokenToRange(node.comment_start), tokenToRange(node.comment_end)])
    this.visitChildNodes(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const ranges: (Range | null)[] = []

    if (node.open_tag && isHTMLOpenTagNode(node.open_tag)) {
      ranges.push(...openTagRanges(node.open_tag))
    } else if (node.open_tag) {
      ranges.push(nodeToRange(node.open_tag))
    }

    if (node.close_tag) {
      ranges.push(nodeToRange(node.close_tag))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const ranges: (Range | null)[] = []

    if (node.name) {
      ranges.push(nodeToRange(node.name))
    }

    if (node.equals) {
      ranges.push(tokenToRange(node.equals))
    }

    if (node.value) {
      ranges.push(nodeToRange(node.value))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitHTMLConditionalElementNode(node: HTMLConditionalElementNode): void {
    const ranges: (Range | null)[] = []

    if (node.open_conditional) {
      ranges.push(erbTagToRange(node.open_conditional))
    }

    if (node.open_tag) {
      ranges.push(...openTagRanges(node.open_tag))
    }

    if (node.close_tag) {
      ranges.push(nodeToRange(node.close_tag))
    }

    if (node.close_conditional) {
      ranges.push(erbTagToRange(node.close_conditional))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.markIfChainAsProcessed(node)

    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    let current: Node | null = node.subsequent

    while (current) {
      if (isERBIfNode(current)) {
        ranges.push(erbTagToRange(current))
        current = current.subsequent
      } else if (isERBElseNode(current)) {
        ranges.push(erbTagToRange(current))
        break
      } else {
        break
      }
    }

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    if (node.else_clause) {
      ranges.push(erbTagToRange(node.else_clause))
    }

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.visitERBAnyCaseNode(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.visitERBAnyCaseNode(node)
  }

  visitERBAnyCaseNode(node: ERBCaseNode | ERBCaseMatchNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    for (const condition of node.conditions) {
      ranges.push(erbTagToRange(condition as ERBNode))
    }

    if (node.else_clause) {
      ranges.push(erbTagToRange(node.else_clause))
    }

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    let rescue: ERBRescueNode | null = node.rescue_clause

    while (rescue) {
      ranges.push(erbTagToRange(rescue))
      rescue = rescue.subsequent
    }

    if (node.else_clause) {
      ranges.push(erbTagToRange(node.else_clause))
    }

    if (node.ensure_clause) {
      ranges.push(erbTagToRange(node.ensure_clause))
    }

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
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

  private addGroup(ranges: (Range | null)[]): void {
    const filtered = ranges.filter((r): r is Range => r !== null)
    if (filtered.length >= 2) {
      this.groups.push(filtered)
    }
  }
}

export class DocumentHighlightService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getDocumentHighlights(textDocument: TextDocument, position: Position): DocumentHighlight[] {
    const parseResult = this.parserService.parseDocument(textDocument)
    const collector = new DocumentHighlightCollector()
    collector.visit(parseResult.document)

    let bestGroup: Range[] | null = null
    let bestSize = Infinity

    for (const group of collector.groups) {
      const matchingRange = group.find(range => isPositionInRange(position, range))

      if (matchingRange) {
        const size = rangeSize(matchingRange)

        if (size < bestSize) {
          bestSize = size
          bestGroup = group
        }
      }
    }

    if (bestGroup) {
      return bestGroup.map(range => DocumentHighlight.create(range, DocumentHighlightKind.Text))
    }

    return []
  }

}
