import { ASTRewriter } from "@herb-tools/rewriter"
import { Visitor } from "@herb-tools/core"

/**
 * Example custom rewriter that uppercases HTML tag names
 */
class UppercaseTagsVisitor extends Visitor {
  visitHTMLElementNode(node) {
    if (node.tag_name?.value) {
      node.tag_name.value = node.tag_name.value.toUpperCase()
    }

    this.visitChildNodes(node)
  }

  visitHTMLOpenTagNode(node) {
    if (node.tag_name?.value) {
      node.tag_name.value = node.tag_name.value.toUpperCase()
    }

    this.visitChildNodes(node)
  }

  visitHTMLCloseTagNode(node) {
    if (node.tag_name?.value) {
      node.tag_name.value = node.tag_name.value.toUpperCase()
    }

    this.visitChildNodes(node)
  }
}

export default class UppercaseTagsRewriter extends ASTRewriter {
  get name() {
    return "uppercase-tags"
  }

  get description() {
    return "Uppercases all HTML tag names (for testing custom rewriters)"
  }

  async initialize(_context) {
    // No initialization needed
  }

  rewrite(node, _context) {
    const visitor = new UppercaseTagsVisitor()
    visitor.visit(node)
    return node
  }
}
