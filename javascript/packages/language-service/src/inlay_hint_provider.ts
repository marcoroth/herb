import { InlayHint, InlayHintKind } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Visitor } from "@herb-tools/core"
import { ParserService } from "./parser_service"
import { elementSelector, erbLabel, defaultNodeLabelOptions } from "./node_labels"

import type { NodeLabelOptions } from "./node_labels"
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
} from "@herb-tools/core"

type ERBNodeWithEnd = ERBIfNode | ERBUnlessNode | ERBBlockNode | ERBCaseNode | ERBCaseMatchNode | ERBWhileNode | ERBUntilNode | ERBForNode | ERBBeginNode

export interface InlayHintOptions extends NodeLabelOptions {
  minimumLines?: number
}

export const defaultInlayHintOptions: Required<InlayHintOptions> = {
  ...defaultNodeLabelOptions,
  minimumLines: 10
}

export class InlayHintProvider {
  private parserService: ParserService

  constructor(parserService: ParserService) {
    this.parserService = parserService
  }

  getInlayHints(textDocument: TextDocument, options: InlayHintOptions = {}): InlayHint[] {
    const parseResult = this.parserService.parseDocument(textDocument)
    const collector = new InlayHintCollector(options)

    collector.visit(parseResult.document)

    return collector.hints
  }
}

export class InlayHintCollector extends Visitor {
  public hints: InlayHint[] = []

  private options: InlayHintOptions
  private minimumLines: number

  constructor(options: InlayHintOptions = {}) {
    super()

    this.options = options
    this.minimumLines = options.minimumLines ?? defaultInlayHintOptions.minimumLines
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.close_tag && node.open_tag) {
      const endLine = node.close_tag.location.start.line
      const startLine = node.open_tag.location.start.line

      if (endLine - startLine >= this.minimumLines) {
        const label = labelForHTMLElement(node, this.options)

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

  private addERBEndNodeHint(node: ERBNodeWithEnd): void {
    const endNode: ERBEndNode | null = node.end_node
    if (!endNode?.tag_closing) return

    const label = labelForERBNode(node, this.options)
    if (!label) return

    const endLine = endNode.location.start.line
    const nodeLine = node.location.start.line

    if (endLine - nodeLine < this.minimumLines) return

    this.hints.push({
      position: lspPosition(endNode.tag_closing.location.end),
      label: ` ${label}`,
      kind: InlayHintKind.Parameter,
      paddingLeft: true,
    })
  }
}

function labelForERBNode(node: ERBNodeWithEnd, options: NodeLabelOptions): string | null {
  const content = erbLabel(node.content?.value, options)

  if (!content) return null

  return `# ${content}`
}

function labelForHTMLElement(node: HTMLElementNode, options: NodeLabelOptions): string | null {
  const selector = elementSelector(node, options)

  if (!selector) return null

  return `<!-- ${selector} -->`
}
