import { DocumentHighlight, DocumentHighlightKind, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Visitor } from "@herb-tools/core"

import type {
  Node,
  Token,
  HTMLElementNode,
  HTMLConditionalElementNode,
  HTMLOpenTagNode,
  HTMLAttributeNode,
  ERBIfNode,
  ERBUnlessNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBBeginNode,
  ERBRescueNode,
  ERBBlockNode,
  ERBForNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBWhenNode,
  ERBInNode,
} from "@herb-tools/core"

import { isERBIfNode, isERBElseNode, isHTMLOpenTagNode } from "@herb-tools/core"

import { ParserService } from "./parser_service"

function erbTagToRange(node: { tag_opening: Token | null; tag_closing: Token | null }): Range | null {
  if (!node.tag_opening || !node.tag_closing) return null

  return Range.create(
    Position.create(node.tag_opening.location.start.line - 1, node.tag_opening.location.start.column),
    Position.create(node.tag_closing.location.end.line - 1, node.tag_closing.location.end.column),
  )
}

function tokenToRange(token: Token | null): Range | null {
  if (!token) return null

  return Range.create(
    Position.create(token.location.start.line - 1, token.location.start.column),
    Position.create(token.location.end.line - 1, token.location.end.column),
  )
}

function nodeToRange(node: { location: { start: { line: number; column: number }; end: { line: number; column: number } } }): Range {
  return Range.create(
    Position.create(node.location.start.line - 1, node.location.start.column),
    Position.create(node.location.end.line - 1, node.location.end.column),
  )
}

function openTagRanges(tag: HTMLOpenTagNode): (Range | null)[] {
  const ranges: (Range | null)[] = []

  if (tag.tag_opening && tag.tag_name) {
    ranges.push(Range.create(
      Position.create(tag.tag_opening.location.start.line - 1, tag.tag_opening.location.start.column),
      Position.create(tag.tag_name.location.end.line - 1, tag.tag_name.location.end.column),
    ))
  }

  ranges.push(tokenToRange(tag.tag_closing))

  return ranges
}

export class DocumentHighlightCollector extends Visitor {
  groups: Range[][] = []
  private processedIfNodes: Set<ERBIfNode> = new Set()

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
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    for (const condition of node.conditions) {
      ranges.push(erbTagToRange(condition as ERBWhenNode))
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

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    for (const condition of node.conditions) {
      ranges.push(erbTagToRange(condition as ERBInNode))
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

  visitERBBlockNode(node: ERBBlockNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

    if (node.end_node) {
      ranges.push(erbTagToRange(node.end_node))
    }

    this.addGroup(ranges)
    this.visitChildNodes(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    const ranges: (Range | null)[] = []
    ranges.push(erbTagToRange(node))

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
      const matchingRange = group.find(range => this.isPositionInRange(position, range))

      if (matchingRange) {
        const size = this.rangeSize(matchingRange)

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

  private rangeSize(range: Range): number {
    if (range.start.line === range.end.line) {
      return range.end.character - range.start.character
    }

    return (range.end.line - range.start.line) * 10000 + range.end.character
  }

  private isPositionInRange(position: Position, range: Range): boolean {
    if (position.line < range.start.line || position.line > range.end.line) {
      return false
    }

    if (position.line === range.start.line && position.character < range.start.character) {
      return false
    }

    if (position.line === range.end.line && position.character > range.end.character) {
      return false
    }

    return true
  }
}
