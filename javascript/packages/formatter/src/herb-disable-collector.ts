import { IdentityPrinter } from "@herb-tools/printer"
import { Visitor, Node, ERBContentNode, HTMLOpenTagNode, HTMLElementNode, WhitespaceNode, isNode, isPureWhitespaceNode } from "@herb-tools/core"
import { isHerbDisableComment } from "./format-helpers.js"

export interface CollectedHerbDisable {
  node: ERBContentNode
  anchor: Node | null
  parentNode: Node
  commentText: string
}

/**
 * HerbDisableCollector walks the AST before formatting, collects all
 * herb:disable comment nodes, finds their anchor nodes (the preceding
 * sibling on the same source line), and removes them from the AST.
 *
 * After formatting, the collected comments are spliced back onto the
 * correct output lines based on where their anchors ended up.
 */
export class HerbDisableCollector extends Visitor {
  readonly collected: CollectedHerbDisable[] = []

  visitChildNodes(node: Node): void {
    this.processArraysOnNode(node)
    super.visitChildNodes(node)
  }

  private processArraysOnNode(node: Node): void {
    for (const value of Object.values(node)) {
      if (!Array.isArray(value)) continue

      this.processArray(value, node)
    }
  }

  private processArray(array: Node[], parentNode: Node): void {
    for (let index = array.length - 1; index >= 0; index--) {
      const child = array[index]

      if (!isHerbDisableComment(child)) continue

      const anchor = this.findAnchor(array, index, parentNode)

      this.collected.push({
        node: child,
        anchor,
        parentNode,
        commentText: IdentityPrinter.print(child).trim(),
      })

      array.splice(index, 1)
    }
  }

  private findAnchor(array: Node[], herbDisableIndex: number, parentNode: Node): Node | null {
    const herbDisableNode = array[herbDisableIndex]

    for (let index = herbDisableIndex - 1; index >= 0; index--) {
      const sibling = array[index]

      if (isPureWhitespaceNode(sibling) || isNode(sibling, WhitespaceNode)) continue
      if (isHerbDisableComment(sibling)) continue

      if (sibling.location.end.line === herbDisableNode.location.start.line) {
        return sibling
      }

      if (isNode(parentNode, HTMLElementNode)) {
        return sibling
      }

      break
    }

    if (isNode(parentNode, HTMLOpenTagNode)) {
      return parentNode
    }

    if (isNode(parentNode, HTMLElementNode)) {
      const openTag = parentNode.open_tag

      if (openTag && openTag.location.end.line === herbDisableNode.location.start.line) {
        return openTag
      }
    }

    return null
  }
}
