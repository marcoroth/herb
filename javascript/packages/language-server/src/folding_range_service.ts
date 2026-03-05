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
  ERBRescueNode,
  ERBEnsureNode,
  ERBElseNode,
  ERBWhenNode,
  ERBInNode,
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
    if (node.body.length > 0 && node.open_tag && node.close_tag) {
      this.addRange(node.open_tag.location.end, node.close_tag.location.start)
    }

    this.visitChildNodes(node)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.children.length > 0 && node.tag_opening && node.tag_closing) {
      this.addRange(node.tag_opening.location.end, node.tag_closing.location.start)
    }

    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    if (node.comment_start && node.comment_end) {
      this.addRange(node.comment_start.location.end, node.comment_end.location.start, FoldingRangeKind.Comment)
    }

    this.visitChildNodes(node)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    if (node.children.length > 0) {
      const first = node.children[0]
      const last = node.children[node.children.length - 1]

      this.addRange(first.location.start, last.location.end)
    }

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
    if (node.tag_closing && 'end_node' in node && node.end_node?.tag_opening) {
      this.addRange(node.tag_closing.location.end, node.end_node.tag_opening.location.start)
    } else {
      this.addRange(node.location.start, node.location.end)
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening && node.tag_closing) {
      this.addRange(node.tag_opening.location.end, node.tag_closing.location.start)
    }

    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.markIfChainAsProcessed(node)

    const nextAfterIf = node.subsequent ?? node.end_node

    if (node.tag_closing && nextAfterIf?.tag_opening) {
      this.addRange(node.tag_closing.location.end, nextAfterIf.tag_opening.location.start)
    }

    let current: ERBIfNode | ERBElseNode | null = node.subsequent

    while (current) {
      if (isERBIfNode(current)) {
        const nextAfterElsif = current.subsequent ?? node.end_node

        if (current.tag_closing && nextAfterElsif?.tag_opening) {
          this.addRange(current.tag_closing.location.end, nextAfterElsif.tag_opening.location.start)
        }

        current = current.subsequent
      } else {
        break
      }
    }

    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const nextAfterUnless = node.else_clause ?? node.end_node

    if (node.tag_closing && nextAfterUnless?.tag_opening) {
      this.addRange(node.tag_closing.location.end, nextAfterUnless.tag_opening.location.start)
    }

    if (node.else_clause) {
      if (node.else_clause.tag_closing && node.end_node?.tag_opening) {
        this.addRange(node.else_clause.tag_closing.location.end, node.end_node.tag_opening.location.start)
      }
    }

    this.visitChildNodes(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.addCaseFoldingRanges(node)
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.addCaseFoldingRanges(node)
    this.visitChildNodes(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.visitChildNodes(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    const nextAfterBegin = node.rescue_clause ?? node.else_clause ?? node.ensure_clause ?? node.end_node

    if (node.tag_closing && nextAfterBegin?.tag_opening) {
      this.addRange(node.tag_closing.location.end, nextAfterBegin.tag_opening.location.start)
    }

    let rescue: ERBRescueNode | null = node.rescue_clause

    while (rescue) {
      const nextAfterRescue = rescue.subsequent ?? node.else_clause ?? node.ensure_clause ?? node.end_node

      if (rescue.tag_closing && nextAfterRescue?.tag_opening) {
        this.addRange(rescue.tag_closing.location.end, nextAfterRescue.tag_opening.location.start)
      }

      rescue = rescue.subsequent
    }

    if (node.else_clause) {
      const nextAfterElse = node.ensure_clause ?? node.end_node

      if (node.else_clause.tag_closing && nextAfterElse?.tag_opening) {
        this.addRange(node.else_clause.tag_closing.location.end, nextAfterElse.tag_opening.location.start)
      }
    }

    if (node.ensure_clause) {
      if (node.ensure_clause.tag_closing && node.end_node?.tag_opening) {
        this.addRange(node.ensure_clause.tag_closing.location.end, node.end_node.tag_opening.location.start)
      }
    }

    this.visitChildNodes(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.addRange(node.location.start, node.location.end)
    this.visitChildNodes(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
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

  private addCaseFoldingRanges(node: ERBCaseNode | ERBCaseMatchNode): void {
    type ConditionNode = ERBWhenNode | ERBInNode
    const conditions = node.conditions as ConditionNode[]

    const firstCondition = conditions[0]
    const nextAfterCase = firstCondition ?? node.else_clause ?? node.end_node

    if (node.tag_closing && nextAfterCase?.tag_opening) {
      this.addRange(node.tag_closing.location.end, nextAfterCase.tag_opening.location.start)
    }

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]
      const nextCondition = conditions[i + 1] ?? node.else_clause ?? node.end_node

      if (condition.tag_closing && nextCondition?.tag_opening) {
        this.addRange(condition.tag_closing.location.end, nextCondition.tag_opening.location.start)
      }
    }

    if (node.else_clause) {
      if (node.else_clause.tag_closing && node.end_node?.tag_opening) {
        this.addRange(node.else_clause.tag_closing.location.end, node.end_node.tag_opening.location.start)
      }
    }
  }

  private addRange(start: SerializedPosition, end: SerializedPosition, kind?: FoldingRangeKind): void {
    const startLine = lspLine(start)
    const endLine = lspLine(end) - 1

    if (endLine > startLine) {
      this.ranges.push({
        startLine,
        startCharacter: start.column,
        endLine,
        endCharacter: end.column,
        kind,
      })
    }
  }
}
