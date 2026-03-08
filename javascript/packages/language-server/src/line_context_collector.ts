import { Visitor, HTMLCommentNode, } from "@herb-tools/core"

import { lspLine } from "./range_utils"
import { isERBCommentNode } from "@herb-tools/core"

import type { Node, ERBNode, ERBContentNode, HTMLTextNode, HTMLElementNode } from "@herb-tools/core"

export type LineContext = "erb-comment" | "html-comment" | "erb-tag" | "html-content" | "empty"

export interface LineInfo {
  line: number
  context: LineContext
  node: Node | null
}

export class LineContextCollector extends Visitor {
  public lineMap: Map<number, LineInfo> = new Map()
  public erbNodesPerLine: Map<number, ERBContentNode[]> = new Map()
  public htmlCommentNodesPerLine: Map<number, HTMLCommentNode> = new Map()

  visitERBNode(node: ERBNode): void {
    if (!node.tag_opening || !node.tag_closing) return

    const startLine = lspLine(node.tag_opening.location.start)

    const nodes = this.erbNodesPerLine.get(startLine) || []
    nodes.push(node as ERBContentNode)
    this.erbNodesPerLine.set(startLine, nodes)

    if (isERBCommentNode(node)) {
      this.setLine(startLine, "erb-comment", node)
    } else {
      this.setLine(startLine, "erb-tag", node)
    }
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.visitERBNode(node)
    this.visitChildNodes(node)
  }

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      this.htmlCommentNodesPerLine.set(line, node)
      this.setLine(line, "html-comment", node)
    }

    this.visitChildNodes(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      if (!this.lineMap.has(line)) {
        this.setLine(line, "html-content", node)
      }
    }

    this.visitChildNodes(node)
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    const startLine = lspLine(node.location.start)
    const endLine = lspLine(node.location.end)

    for (let line = startLine; line <= endLine; line++) {
      if (!this.lineMap.has(line)) {
        this.setLine(line, "html-content", node)
      }
    }

    this.visitChildNodes(node)
  }

  private setLine(line: number, context: LineContext, node: Node): void {
    const existing = this.lineMap.get(line)

    if (existing) {
      if (existing.context === "erb-comment" || existing.context === "erb-tag") return

      if (context === "erb-comment" || context === "erb-tag") {
        this.lineMap.set(line, { line, context, node })

        return
      }

      if (existing.context === "html-comment") return
    }

    this.lineMap.set(line, { line, context, node })
  }
}
