import { InlayHint, InlayHintKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor, isHTMLOpenTagNode, isLiteralNode } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { lspPosition } from "./range_utils"

import type {
  ERBEndNode,
  ERBIfNode,
  ERBUnlessNode,
  ERBBlockNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBForNode,
  ERBBeginNode,
  HTMLElementNode,
  HTMLOpenTagNode,
  HTMLAttributeNode,
  Node,
} from "@herb-tools/core"

type ERBNodeWithEnd = ERBIfNode | ERBUnlessNode | ERBBlockNode | ERBCaseNode | ERBCaseMatchNode | ERBWhileNode | ERBUntilNode | ERBForNode | ERBBeginNode

function labelForERBNode(node: ERBNodeWithEnd): string | null {
  const content = node.content?.value?.trim()

  if (!content) return null

  return `# ${content}`
}

function findAttributeValue(openTag: HTMLOpenTagNode, attributeName: string): string | null {
  for (const child of openTag.children) {
    if (child.type !== "AST_HTML_ATTRIBUTE_NODE") continue

    const attrNode = child as unknown as HTMLAttributeNode
    if (!attrNode.name || !attrNode.value) continue

    const nameStr = attrNode.name.children
      .filter(isLiteralNode)
      .map(n => n.content)
      .join("")

    if (nameStr !== attributeName) continue

    const valueStr = attrNode.value.children
      .filter(isLiteralNode)
      .map(n => n.content)
      .join("")

    return valueStr
  }

  return null
}

function labelForHTMLElement(node: HTMLElementNode): string | null {
  if (!node.open_tag || !isHTMLOpenTagNode(node.open_tag)) return null

  const id = findAttributeValue(node.open_tag, "id")
  if (id) return `<!-- #${id} -->`

  const className = findAttributeValue(node.open_tag, "class")
  if (className) return `<!-- .${className.split(/\s+/).join(".")} -->`

  return null
}

export class InlayHintCollector extends Visitor {
  public hints: InlayHint[] = []

  private addERBEndNodeHint(node: ERBNodeWithEnd): void {
    const endNode: ERBEndNode | null = node.end_node
    if (!endNode?.tag_closing) return

    const label = labelForERBNode(node)
    if (!label) return

    const endLine = endNode.location.start.line
    const nodeLine = node.location.start.line

    if (endLine - nodeLine < 2) return

    this.hints.push({
      position: lspPosition(endNode.tag_closing.location.end),
      label: ` ${label}`,
      kind: InlayHintKind.Parameter,
      paddingLeft: true,
    })
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.close_tag && node.open_tag) {
      const endLine = node.close_tag.location.start.line
      const startLine = node.open_tag.location.start.line

      if (endLine - startLine >= 2) {
        const label = labelForHTMLElement(node)

        if (label) {
          this.hints.push({
            position: lspPosition(node.close_tag.location.end),
            label: ` ${label}`,
            kind: InlayHintKind.Parameter,
            paddingLeft: true,
          })
        }
      }
    }

    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.addERBEndNodeHint(node)
    this.visitChildNodes(node)
  }
}

export class InlayHintService {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getInlayHints(textDocument: TextDocument): InlayHint[] {
    const parseResult = this.parserService.parseDocument(textDocument)
    const collector = new InlayHintCollector()

    collector.visit(parseResult.document)

    return collector.hints
  }
}
