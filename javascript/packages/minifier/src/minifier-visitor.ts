import { Visitor } from "@herb-tools/core"
import { asMutable } from "@herb-tools/rewriter"

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
  isERBContentNode,
  isLiteralNode,
  isWhitespaceNode,
  isERBIfNode,
  isHTMLAttributeNode,
  isERBNode,
} from "@herb-tools/core"

/**
 * Visitor that minifies HTML+ERB documents by removing non-significant whitespace
 */
export class MinifierVisitor extends Visitor {
  private preserveWhitespaceDepth = 0
  private preserveWhitespaceTags = new Set(["pre", "code"])
  private currentParent: HTMLElementNode | null = null
  private currentAttributeName: string | null = null
  private currentOpenTag: HTMLOpenTagNode | null = null
  private currentAttributeValue: HTMLAttributeValueNode | null = null
  private currentERBIf: ERBIfNode | null = null

  private shouldPreserveWhitespace(): boolean {
    return this.preserveWhitespaceDepth > 0
  }

  private isPreserveWhitespaceTag(tagName: string): boolean {
    return this.preserveWhitespaceTags.has(tagName.toLowerCase())
  }

  private isFirstChild(node: Node): boolean {
    if (!this.currentParent?.body) return true
    return this.currentParent.body[0] === node
  }

  private isLastChild(node: Node): boolean {
    if (!this.currentParent?.body) return true
    const body = this.currentParent.body

    return body[body.length - 1] === node
  }

  private hasAdjacentInlineContent(node: Node): { before: boolean; after: boolean } {
    if (!this.currentParent?.body) return { before: false, after: false }

    const body = this.currentParent.body
    const index = body.indexOf(node)

    if (index === -1) return { before: false, after: false }

    const isInlineNode = (node: Node | undefined): boolean => {
      if (!node) return false

      return isHTMLTextNode(node) || isERBContentNode(node) || isLiteralNode(node)
    }

    const before = index > 0 && isInlineNode(body[index - 1])
    const after = index < body.length - 1 && isInlineNode(body[index + 1])

    return { before, after }
  }

  private minifyWhitespace(content: string, node: Node): string {
    let minified = content.replace(/\s+/g, " ")

    const isFirst = this.isFirstChild(node)
    const isLast = this.isLastChild(node)
    const { before, after } = this.hasAdjacentInlineContent(node)

    if (minified === " " && !before && !after) {
      return ""
    }

    if (isFirst || !before) {
      minified = minified.replace(/^\s+/, "")
    }

    if (isLast || !after) {
      minified = minified.replace(/\s+$/, "")
    }

    return minified
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = node.tag_name?.value || ""
    const shouldPreserve = this.isPreserveWhitespaceTag(tagName)

    if (shouldPreserve) {
      this.preserveWhitespaceDepth++
    }

    const previousParent = this.currentParent
    this.currentParent = node

    super.visitHTMLElementNode(node)

    this.currentParent = previousParent

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

  visitLiteralNode(node: LiteralNode): void {
    if (!this.shouldPreserveWhitespace() && node.content) {
      if (this.currentAttributeName === "class" && this.currentAttributeValue) {
        let minified = node.content.replace(/\s+/g, " ")

        const children = this.currentAttributeValue.children

        if (children) {
          const index = children.indexOf(node)

          if (index !== -1) {
            const hasERBBefore = index > 0 && isERBContentNode(children[index - 1])
            const hasERBAfter = index < children.length - 1 && isERBContentNode(children[index + 1])

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

  visitWhitespaceNode(node: WhitespaceNode): void {
    if (node.value?.value) {
      const token = node.value
      const originalValue = token.value

      const context = this.currentERBIf || this.currentOpenTag
      let children: Node[] | undefined

      if (this.currentERBIf) {
        children = this.currentERBIf.statements
      } else if (this.currentOpenTag) {
        children = this.currentOpenTag.children
      }


      if (context && children) {
        if (this.currentOpenTag && children[children.length - 1] === node) {
          const tagClosing = this.currentOpenTag.tag_closing?.value || ""
          const isSelfClosing = tagClosing.includes("/")

          if (isSelfClosing && originalValue === " ") {
            asMutable(token).value = " "
          } else {
            asMutable(token).value = ""
          }

          super.visitWhitespaceNode(node)
          return
        }

        const index = children.indexOf(node)

        if (index >= 0) {
          const prevNode = index > 0 ? children[index - 1] : null
          const nextNode = index < children.length - 1 ? children[index + 1] : null

          if (this.currentERBIf) {
            let firstNonWhitespaceIndex = 0

            while (firstNonWhitespaceIndex < children.length && isWhitespaceNode(children[firstNonWhitespaceIndex])) {
              firstNonWhitespaceIndex++
            }

            let lastNonWhitespaceIndex = children.length - 1

            while (lastNonWhitespaceIndex >= 0 && isWhitespaceNode(children[lastNonWhitespaceIndex])) {
              lastNonWhitespaceIndex--
            }

            if (index < firstNonWhitespaceIndex) {
              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }

            if (index > lastNonWhitespaceIndex) {
              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }
          }

          if (this.currentOpenTag) {
            if (isERBIfNode(prevNode)) {
              let nextNonWhitespace: Node | null = nextNode
              let searchIndex = index + 1

              while (isWhitespaceNode(nextNonWhitespace) && searchIndex < children.length - 1) {
                searchIndex++
                nextNonWhitespace = children[searchIndex]
              }

              if (isHTMLAttributeNode(nextNonWhitespace)) {
                asMutable(token).value = " "
                super.visitWhitespaceNode(node)

                return
              } else {
                asMutable(token).value = ""
                super.visitWhitespaceNode(node)

                return
              }
            }

            if (isERBIfNode(nextNode)) {
              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }

            if (isWhitespaceNode(prevNode)) {
              let searchIndex = index - 1

              while (searchIndex >= 0 && isWhitespaceNode(children[searchIndex])) {
                searchIndex--
              }

              if (searchIndex >= 0 && isERBIfNode(children[searchIndex])) {
                asMutable(token).value = ""
                super.visitWhitespaceNode(node)

                return
              }

              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }

            if (isERBNode(prevNode) && isHTMLAttributeNode(nextNode)) {
              asMutable(token).value = " "
              super.visitWhitespaceNode(node)

              return
            }

            if (isERBNode(prevNode)) {
              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }

            if (isERBNode(nextNode)) {
              asMutable(token).value = ""
              super.visitWhitespaceNode(node)

              return
            }
          }
        }

        asMutable(token).value = " "
        super.visitWhitespaceNode(node)

        return
      }

      asMutable(token).value = " "
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
    if (node.content) {
      const trimmed = node.content.value.trim()

      if (trimmed !== node.content.value) {
        asMutable(node.content).value = trimmed
      }
    }

    const previousERBIf = this.currentERBIf
    this.currentERBIf = node

    super.visitERBIfNode(node)

    this.currentERBIf = previousERBIf
  }

  visitERBElseNode(node: ERBElseNode): void {
    if (node.content) {
      const trimmed = node.content.value.trim()

      if (trimmed !== node.content.value) {
        asMutable(node.content).value = trimmed
      }
    }

    super.visitERBElseNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.content) {
      const inAttributeValue = !!this.currentAttributeValue
      const inERBIf = !!this.currentERBIf
      const inMultiLineAttribute = inAttributeValue && this.isMultiLineAttribute()
      const hasExcessiveSurroundingWhitespace = this.hasExcessiveWhitespaceAround(node)

      if ((inAttributeValue && (inERBIf || inMultiLineAttribute)) || hasExcessiveSurroundingWhitespace) {
        const trimmed = node.content.value.trim()

        if (trimmed !== node.content.value) {
          asMutable(node.content).value = trimmed
        }
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
    if (!this.currentParent?.body) return false

    const body = this.currentParent.body
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
    if (node.content) {
      const trimmed = node.content.value.trim()

      if (trimmed !== node.content.value) {
        asMutable(node.content).value = trimmed
      }
    }

    super.visitERBEndNode(node)
  }
}
