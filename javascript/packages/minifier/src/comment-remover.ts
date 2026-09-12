import { Visitor, findParentArray, isHTMLTextNode, isLiteralNode } from "@herb-tools/core"

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

export function removeComments(root: Node): void {
  const collector = new CommentCollector()

  root.accept(collector)

  for (const comment of collector.comments) {
    const parent = findParentArray(root, comment)

    if (parent) {
      parent.array.splice(parent.index, 1)
    }
  }
}
