import { Visitor, HTMLOpenTagNode, HTMLCloseTagNode, HTMLElementNode, HTMLAttributeValueNode, WhitespaceNode, ERBContentNode } from "@herb-tools/core"
import { isHTMLAttributeNode, isERBOpenTagNode, isRubyLiteralNode, isRubyHTMLAttributesSplatNode, isWhitespaceNode, createSyntheticToken } from "@herb-tools/core"

import { ASTRewriter } from "../ast-rewriter.js"
import { asMutable } from "../mutable.js"

import type { RewriteContext } from "../context.js"
import type { Node } from "@herb-tools/core"

function createWhitespaceNode(): WhitespaceNode {
  return WhitespaceNode.build({ value: createSyntheticToken(" ") })
}

class ActionViewTagHelperToHTMLVisitor extends Visitor {
  private shallow: boolean
  private includeBody: boolean

  constructor(options: { shallow?: boolean; includeBody?: boolean } = {}) {
    super()
    this.shallow = options.shallow ?? false
    this.includeBody = options.includeBody ?? true
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const newChildren: Node[] = []

    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index]

      if (isHTMLAttributeNode(child)) {
        if (child.equals && child.equals.value !== "=") {
          asMutable(child).equals = createSyntheticToken("=")
        }

        if (child.value) {
          this.transformAttributeValue(child.value)
        }

        const previous = index > 0 ? node.children[index - 1] : null

        if (!previous || !isWhitespaceNode(previous)) {
          newChildren.push(createWhitespaceNode())
        }
      }

      newChildren.push(child)
    }

    asMutable(node).children = newChildren

    this.visitChildNodes(node)
  }

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

        htmlChildren.push(ERBContentNode.build({
          tag_opening: createSyntheticToken("<%="),
          content: createSyntheticToken(` ${child.content} `),
          tag_closing: createSyntheticToken("%>"),
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

    const htmlOpenTag = HTMLOpenTagNode.build({
      location: openTag.location,
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
      const htmlCloseTag = HTMLCloseTagNode.build({
        location: node.close_tag.location,
        tag_opening: createSyntheticToken("</"),
        tag_name: createSyntheticToken(tagName.value),
        tag_closing: createSyntheticToken(">"),
      })

      asMutable(node).close_tag = htmlCloseTag
    }

    asMutable(node).element_source = "HTML"

    if (!this.includeBody) {
      asMutable(node).body = []
    } else if (node.body) {
      asMutable(node).body = node.body.map(child => {
        if (isRubyLiteralNode(child)) {
          return ERBContentNode.build({
            location: child.location,
            tag_opening: createSyntheticToken("<%="),
            content: createSyntheticToken(` ${child.content} `),
            tag_closing: createSyntheticToken("%>"),
            valid: true,
          })
        }

        if (!this.shallow) {
          this.visit(child)
        }

        return child
      })
    }
  }

  private transformAttributeValue(value: HTMLAttributeValueNode): void {
    const mutableValue = asMutable(value)
    const hasRubyLiteral = value.children.some(child => isRubyLiteralNode(child))

    if (hasRubyLiteral) {
      const newChildren: Node[] = value.children.map(child => {
        if (isRubyLiteralNode(child)) {
          return ERBContentNode.build({
            location: child.location,
            tag_opening: createSyntheticToken("<%="),
            content: createSyntheticToken(` ${child.content} `),
            tag_closing: createSyntheticToken("%>"),
            valid: true,
          })
        }

        return child
      })

      mutableValue.children = newChildren
    }

    if (!value.quoted) {
      mutableValue.quoted = true
      mutableValue.open_quote = createSyntheticToken('"')
      mutableValue.close_quote = createSyntheticToken('"')
    }
  }
}

export class ActionViewTagHelperToHTMLRewriter extends ASTRewriter {
  get name(): string {
    return "action-view-tag-helper-to-html"
  }

  get description(): string {
    return "Converts ActionView tag helpers to raw HTML elements"
  }

  rewrite<T extends Node>(node: T, context: RewriteContext): T {
    const visitor = new ActionViewTagHelperToHTMLVisitor({ shallow: context.shallow, includeBody: context.includeBody })

    visitor.visit(node)

    return node
  }
}
