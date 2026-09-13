import { Visitor } from "@herb-tools/core"
import { asMutable } from "@herb-tools/rewriter"
import { erbTagContent, endsInLineComment } from "./comment-separator.js"

import type {
  LiteralNode,
  HTMLElementNode,
  HTMLTextNode,
  Node,
  WhitespaceNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLOpenTagNode,
  ERBContentNode,
  ERBIfNode,
  ERBEndNode,
  ERBElseNode,
} from "@herb-tools/core"

import {
  isHTMLTextNode,
  isLiteralNode,
  isWhitespaceNode,
  isHTMLAttributeNode,
  isHTMLElementNode,
  isHTMLOpenTagNode,
  isHTMLDoctypeNode,
  isXMLDeclarationNode,
  isERBNode,
  getTagName,
  isInlineElement,
  isWhitespacePreservingElement,
} from "@herb-tools/core"

const CHILD_ARRAY_PROPERTIES = ["children", "body", "statements", "conditions"]
const ERB_TAG_MODIFIERS = new Set(["#", "=", "-", "%"])

function needsSpaceBeforeSelfClosing(openTag: HTMLOpenTagNode, previous: Node): boolean {
  if (!(openTag.tag_closing?.value ?? "").includes("/")) return false
  if (!isHTMLAttributeNode(previous)) return false

  return previous.value !== null && !previous.value.quoted
}

/**
 * Visitor that minifies HTML+ERB documents by removing non-significant whitespace
 */
export class MinifierVisitor extends Visitor {
  private preserveWhitespaceDepth = 0
  private currentSiblings: Node[] | null = null
  private currentContainer: Node | null = null
  private currentEdgesAreInline = false
  private currentAttributeName: string | null = null
  private currentOpenTag: HTMLOpenTagNode | null = null
  private currentAttributeValue: HTMLAttributeValueNode | null = null
  private currentERBIf: ERBIfNode | null = null

  private trimTagContent(token: { value: string } | null | undefined): void {
    if (!token) return

    const trimmed = token.value.trim()

    if (trimmed === token.value) return
    if (ERB_TAG_MODIFIERS.has(trimmed[0])) return
    if (token.value.includes("\n")) return

    asMutable(token).value = trimmed
  }

  private shouldPreserveWhitespace(): boolean {
    return this.preserveWhitespaceDepth > 0
  }

  private isInlineNeighbour(node: Node | undefined): boolean {
    if (!node) return false
    if (isHTMLTextNode(node) || isLiteralNode(node)) return node.content !== ""
    if (isERBNode(node)) return true
    if (isHTMLElementNode(node)) return isInlineElement(getTagName(node) ?? "")

    return false
  }

  private endsWithSpace(node: Node | undefined): boolean {
    if (!node) return false
    if (isHTMLTextNode(node) || isLiteralNode(node)) return node.content.endsWith(" ")

    return false
  }

  private edgesAreInlineFor(node: Node, property: string): boolean {
    if (isERBNode(node)) return true
    if (isHTMLElementNode(node) && property === "body") return isInlineElement(getTagName(node) ?? "")

    return false
  }

  visitChildNodes(node: Node): void {
    const record = node as unknown as Record<string, unknown>
    const previousSiblings = this.currentSiblings
    const previousEdges = this.currentEdgesAreInline
    const previousContainer = this.currentContainer

    for (const child of node.compactChildNodes()) {
      this.currentSiblings = previousSiblings
      this.currentEdgesAreInline = previousEdges
      this.currentContainer = previousContainer

      for (const property of CHILD_ARRAY_PROPERTIES) {
        const array = record[property]

        if (Array.isArray(array) && array.includes(child)) {
          this.currentSiblings = array
          this.currentEdgesAreInline = this.edgesAreInlineFor(node, property)
          this.currentContainer = node
          break
        }
      }

      child.accept(this)
    }

    this.currentSiblings = previousSiblings
    this.currentEdgesAreInline = previousEdges
    this.currentContainer = previousContainer
  }

  private hasAdjacentInlineContent(node: Node): { before: boolean; after: boolean; previous?: Node } {
    const siblings = this.currentSiblings

    if (!siblings) return { before: false, after: false }

    const index = siblings.indexOf(node)

    if (index === -1) return { before: false, after: false }

    const previous = siblings[index - 1]
    const next = siblings[index + 1]

    return {
      before: previous ? this.isInlineNeighbour(previous) && !this.endsWithSpace(previous) : this.currentEdgesAreInline,
      after: next ? this.isInlineNeighbour(next) : this.currentEdgesAreInline,
      previous,
    }
  }

  private minifyWhitespace(content: string, node: Node): string {
    const { before, after, previous } = this.hasAdjacentInlineContent(node)
    const needsNewline = previous !== undefined && isERBNode(previous) && endsInLineComment(erbTagContent(previous))

    let minified = content.replace(/\s+/g, " ")

    if (!before && !needsNewline) minified = minified.replace(/^ /, "")
    if (!after) minified = minified.replace(/ $/, "")

    if (needsNewline) minified = "\n" + minified.replace(/^ /, "")

    return minified
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const shouldPreserve = isWhitespacePreservingElement(getTagName(node) ?? "")

    if (shouldPreserve) {
      this.preserveWhitespaceDepth++
    }

    super.visitHTMLElementNode(node)

    if (shouldPreserve) {
      this.preserveWhitespaceDepth--
    }
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
    if (!this.shouldPreserveWhitespace() && node.content) {
      const minified = this.minifyWhitespace(node.content, node)
      asMutable(node).content = minified
    }

    super.visitHTMLTextNode(node)
  }

  private inDeclaration(): boolean {
    return isXMLDeclarationNode(this.currentContainer) || isHTMLDoctypeNode(this.currentContainer)
  }

  visitLiteralNode(node: LiteralNode): void {
    if (!this.shouldPreserveWhitespace() && !this.inDeclaration() && node.content) {
      if (this.currentAttributeName === "class" && this.currentAttributeValue) {
        let minified = node.content.replace(/\s+/g, " ")

        const children = this.currentAttributeValue.children

        if (children) {
          const index = children.indexOf(node)

          if (index !== -1) {
            const hasERBBefore = index > 0 && isERBNode(children[index - 1])
            const hasERBAfter = index < children.length - 1 && isERBNode(children[index + 1])

            if (!hasERBBefore) {
              minified = minified.replace(/^\s+/, "")
            }

            if (!hasERBAfter) {
              minified = minified.replace(/\s+$/, "")
            }
          }
        } else {
          minified = minified.trim()
        }

        asMutable(node).content = minified
      } else if (!this.currentAttributeName) {
        const minified = this.minifyWhitespace(node.content, node)
        asMutable(node).content = minified
      }
    }

    super.visitLiteralNode(node)
  }

  private firstRealSibling(from: number, step: number): Node | undefined {
    const siblings = this.currentSiblings

    if (!siblings) return undefined

    for (let index = from; index >= 0 && index < siblings.length; index += step) {
      if (!isWhitespaceNode(siblings[index])) return siblings[index]
    }

    return undefined
  }

  visitWhitespaceNode(node: WhitespaceNode): void {
    const token = node.value
    const siblings = this.currentSiblings

    if (!token || !siblings) {
      super.visitWhitespaceNode(node)
      return
    }

    const index = siblings.indexOf(node)

    if (index === -1) {
      super.visitWhitespaceNode(node)
      return
    }

    const inOpenTag = isHTMLOpenTagNode(this.currentContainer)
    const previous = this.firstRealSibling(index - 1, -1)
    const next = this.firstRealSibling(index + 1, 1)

    if (isWhitespaceNode(siblings[index - 1])) {
      asMutable(token).value = ""
    } else if (previous && next) {
      asMutable(token).value = " "
    } else if (!previous) {
      asMutable(token).value = inOpenTag ? " " : ""
    } else if (inOpenTag && needsSpaceBeforeSelfClosing(this.currentContainer as HTMLOpenTagNode, previous)) {
      asMutable(token).value = " "
    } else {
      asMutable(token).value = ""
    }

    super.visitWhitespaceNode(node)
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const nameNode = node.name?.children?.[0] as LiteralNode | undefined
    const previousAttributeName = this.currentAttributeName

    if (nameNode?.content) {
      this.currentAttributeName = nameNode.content
    }

    if (node.equals) {
      const trimmed = node.equals.value.trim()

      if (trimmed !== node.equals.value) {
        asMutable(node.equals).value = trimmed
      }
    }

    super.visitHTMLAttributeNode(node)

    this.currentAttributeName = previousAttributeName
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    const previousAttributeValue = this.currentAttributeValue
    this.currentAttributeValue = node

    super.visitHTMLAttributeValueNode(node)

    this.currentAttributeValue = previousAttributeValue
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const previousOpenTag = this.currentOpenTag
    this.currentOpenTag = node

    super.visitHTMLOpenTagNode(node)

    this.currentOpenTag = previousOpenTag
  }

  visitERBIfNode(node: ERBIfNode): void {
    this.trimTagContent(node.content)

    const previousERBIf = this.currentERBIf
    this.currentERBIf = node

    super.visitERBIfNode(node)

    this.currentERBIf = previousERBIf
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.trimTagContent(node.content)

    super.visitERBElseNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.content) {
      const inAttributeValue = !!this.currentAttributeValue
      const inERBIf = !!this.currentERBIf
      const inMultiLineAttribute = inAttributeValue && this.isMultiLineAttribute()
      const hasExcessiveSurroundingWhitespace = this.hasExcessiveWhitespaceAround(node)

      if ((inAttributeValue && (inERBIf || inMultiLineAttribute)) || hasExcessiveSurroundingWhitespace) {
        this.trimTagContent(node.content)
      }
    }

    super.visitERBContentNode(node)
  }

  private isMultiLineAttribute(): boolean {
    if (!this.currentAttributeValue) return false

    const checkForNewlines = (nodes: Node[] | undefined): boolean => {
      if (!nodes) return false

      return nodes.some(node => {
        if (isLiteralNode(node)) {
          const literal = node as LiteralNode

          return !!(literal.content && literal.content.includes('\n'))
        }

        return false
      })
    }

    return checkForNewlines(this.currentAttributeValue.children)
  }

  private hasExcessiveWhitespaceAround(node: Node): boolean {
    const body = this.currentSiblings

    if (!body) return false

    const index = body.indexOf(node)

    if (index === -1) return false

    const checkWhitespace = (node: Node | undefined): boolean => {
      if (!node) return false

      if (isHTMLTextNode(node)) {
        return !!(node.content && node.content.match(/\s{2,}|\n/))
      }

      return false
    }

    const before = index > 0 && checkWhitespace(body[index - 1])
    const after = index < body.length - 1 && checkWhitespace(body[index + 1])

    return before || after
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.trimTagContent(node.content)

    super.visitERBEndNode(node)
  }
}
