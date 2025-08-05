import { Visitor } from "@herb-tools/core"
import {
  Node,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLTextNode,
  LiteralNode,
  Token
} from "@herb-tools/core"

import { TailwindVisitor, ClassAttribute } from "./visitor.js"

/**
 * Rewriter that applies sorted Tailwind classes back to the AST
 */
export class TailwindRewriter extends Visitor {
  private classAttributeMap: Map<HTMLAttributeNode, ClassAttribute>

  constructor(classAttributes: ClassAttribute[]) {
    super()
    // Create a map for quick lookup of class attributes
    this.classAttributeMap = new Map(
      classAttributes.map(attr => [attr.node, attr])
    )
  }

  /**
   * Visit HTML attribute nodes and update class attributes with sorted content
   */
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const classAttribute = this.classAttributeMap.get(node)
    
    if (classAttribute && classAttribute.sortedContent !== null) {
      this.updateClassAttribute(node, classAttribute.sortedContent)
    }

    // Continue visiting children
    super.visitHTMLAttributeNode(node)
  }

  /**
   * Update the content of a class attribute with sorted classes
   */
  private updateClassAttribute(attribute: HTMLAttributeNode, sortedContent: string): void {
    if (!attribute.value || (attribute.value as any).type !== 'AST_HTML_ATTRIBUTE_VALUE_NODE') {
      return
    }

    const attributeValue = attribute.value as HTMLAttributeValueNode

    // Find the text/literal nodes and update their content
    for (let i = 0; i < attributeValue.children.length; i++) {
      const child = attributeValue.children[i]
      
      if ((child as any).type === 'AST_HTML_TEXT_NODE') {
        const textNode = child as HTMLTextNode
        if (textNode.content.trim()) {
          // Create a new text node with updated content (content property is read-only)
          const newTextNode = Object.assign(Object.create(Object.getPrototypeOf(textNode)), textNode, {
            content: sortedContent
          })
          ;(attributeValue.children as any)[i] = newTextNode
        }
      } else if ((child as any).type === 'AST_LITERAL_NODE') {
        const literalNode = child as LiteralNode
        if (literalNode.content.trim()) {
          // Create a new literal node with updated content (content property is read-only)
          const newLiteralNode = Object.assign(Object.create(Object.getPrototypeOf(literalNode)), literalNode, {
            content: sortedContent
          })
          ;(attributeValue.children as any)[i] = newLiteralNode
        }
      }
    }
  }
}

/**
 * Options for Tailwind class sorting
 */
export interface TailwindSortOptions {
  /** Whether to enable Tailwind class sorting */
  enabled?: boolean
  /** Whether to log statistics about the sorting operation */
  verbose?: boolean
}