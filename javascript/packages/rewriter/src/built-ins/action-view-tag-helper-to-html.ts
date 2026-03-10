import { Visitor, Location, HTMLOpenTagNode, HTMLCloseTagNode, HTMLElementNode, HTMLAttributeValueNode, WhitespaceNode, ERBContentNode } from "@herb-tools/core"
import { isHTMLAttributeNode, isERBOpenTagNode, isRubyLiteralNode, isRubyHTMLAttributesSplatNode, createSyntheticToken } from "@herb-tools/core"

import { ASTRewriter } from "../ast-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"
import type { Node } from "@herb-tools/core"

function createWhitespaceNode(): WhitespaceNode {
  return new WhitespaceNode({
    type: "AST_WHITESPACE_NODE",
    location: Location.zero,
    errors: [],
    value: createSyntheticToken(" "),
  })
}

class ActionViewTagHelperToHTMLVisitor extends Visitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!node.element_source) {
      this.visitChildNodes(node)
      return
    }

    const openTag = node.open_tag

    if (!isERBOpenTagNode(openTag)) {
      this.visitChildNodes(node)
      return
    }

    const tagName = openTag.tag_name

    if (!tagName) {
      this.visitChildNodes(node)
      return
    }

    const htmlChildren: Node[] = []

    for (const child of openTag.children) {
      if (isRubyHTMLAttributesSplatNode(child)) {
        htmlChildren.push(createWhitespaceNode())

        htmlChildren.push(new ERBContentNode({
          type: "AST_ERB_CONTENT_NODE",
          location: Location.zero,
          errors: [],
          tag_opening: createSyntheticToken("<%="),
          content: createSyntheticToken(` ${child.content} `),
          tag_closing: createSyntheticToken("%>"),
          parsed: false,
          valid: true,
        }))

        continue
      }

      htmlChildren.push(createWhitespaceNode())

      if (isHTMLAttributeNode(child)) {
        if (child.equals && child.equals.value !== "=") {
          asMutable(child).equals = createSyntheticToken("=")
        }

        if (child.value) {
          this.transformAttributeValue(child.value)
        }

        htmlChildren.push(child)
      }
    }

    const htmlOpenTag = new HTMLOpenTagNode({
      type: "AST_HTML_OPEN_TAG_NODE",
      location: openTag.location,
      errors: [],
      tag_opening: createSyntheticToken("<"),
      tag_name: createSyntheticToken(tagName.value),
      tag_closing: createSyntheticToken(node.is_void ? " />" : ">"),
      children: htmlChildren,
      is_void: node.is_void,
    })

    asMutable(node).open_tag = htmlOpenTag

    if (node.is_void) {
      asMutable(node).close_tag = null
    } else if (node.close_tag) {
      const htmlCloseTag = new HTMLCloseTagNode({
        type: "AST_HTML_CLOSE_TAG_NODE",
        location: node.close_tag.location,
        errors: [],
        tag_opening: createSyntheticToken("</"),
        tag_name: createSyntheticToken(tagName.value),
        children: [],
        tag_closing: createSyntheticToken(">"),
      })

      asMutable(node).close_tag = htmlCloseTag
    }

    asMutable(node).element_source = "HTML"

    if (node.body) {
      for (const child of node.body) {
        this.visit(child)
      }
    }
  }

  private transformAttributeValue(value: HTMLAttributeValueNode): void {
    const mutableValue = asMutable(value)
    const hasRubyLiteral = value.children.some(child => isRubyLiteralNode(child))

    if (hasRubyLiteral) {
      const newChildren: Node[] = value.children.map(child => {
        if (isRubyLiteralNode(child)) {
          return new ERBContentNode({
            type: "AST_ERB_CONTENT_NODE",
            location: child.location,
            errors: [],
            tag_opening: createSyntheticToken("<%="),
            content: createSyntheticToken(` ${child.content} `),
            tag_closing: createSyntheticToken("%>"),
            parsed: false,
            valid: true,
          })
        }

        return child
      })

      mutableValue.children = newChildren

      if (!value.quoted) {
        mutableValue.quoted = true
        mutableValue.open_quote = createSyntheticToken('"')
        mutableValue.close_quote = createSyntheticToken('"')
      }
    }
  }
}

export class ActionViewTagHelperToHTMLRewriter extends ASTRewriter {
  get name(): string {
    return "action-view-tag-helper-to-html"
  }

  get description(): string {
    return "Converts ActionView tag helpers (tag.*, content_tag, link_to) to raw HTML elements"
  }

  rewrite<T extends Node>(node: T, _context: RewriteContext): T {
    const visitor = new ActionViewTagHelperToHTMLVisitor()

    visitor.visit(node)

    return node
  }
}
