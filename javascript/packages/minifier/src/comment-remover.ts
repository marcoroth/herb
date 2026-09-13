import { Visitor, findParentArray, isHTMLTextNode, isLiteralNode } from "@herb-tools/core"
import { asMutable } from "@herb-tools/rewriter"

import type { Node, HTMLCommentNode, ERBCommentNode } from "@herb-tools/core"

function isConditionalComment(node: HTMLCommentNode): boolean {
  const text = node.children.map(child => (isHTMLTextNode(child) || isLiteralNode(child) ? child.content : "")).join("")

  return text.trimStart().startsWith("[if") || text.includes("<![endif]")
}

function isHerbDirective(node: ERBCommentNode): boolean {
  return (node.content?.value ?? "").trimStart().startsWith("herb:")
}

class CommentCollector extends Visitor {
  readonly comments: Node[] = []

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    if (!isConditionalComment(node)) {
      this.comments.push(node)
      return
    }

    super.visitHTMLCommentNode(node)
  }

  visitERBCommentNode(node: ERBCommentNode): void {
    if (!isHerbDirective(node)) {
      this.comments.push(node)
      return
    }

    super.visitERBCommentNode(node)
  }
}

const CHILD_ARRAY_PROPERTIES = ["children", "body", "statements", "conditions"]

function isTextRun(node: Node | undefined): boolean {
  return node !== undefined && (isHTMLTextNode(node) || isLiteralNode(node))
}

function mergeAdjacentTextRuns(node: Node): void {
  const record = node as unknown as Record<string, unknown>

  for (const property of CHILD_ARRAY_PROPERTIES) {
    const array = record[property]

    if (!Array.isArray(array)) continue

    for (let index = array.length - 1; index > 0; index--) {
      const current = array[index]
      const previous = array[index - 1]

      if (!isTextRun(current) || !isTextRun(previous)) continue
      if (current.constructor !== previous.constructor) continue

      asMutable(previous).content = previous.content + current.content
      array.splice(index, 1)
    }
  }

  for (const child of node.compactChildNodes()) {
    mergeAdjacentTextRuns(child)
  }
}

export function removeComments(root: Node): void {
  const collector = new CommentCollector()

  root.accept(collector)

  for (const comment of collector.comments) {
    const parent = findParentArray(root, comment)

    if (parent) {
      parent.array.splice(parent.index, 1)
    }
  }

  mergeAdjacentTextRuns(root)
}
