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

    this.classAttributeMap = new Map(
      classAttributes.map(attribute => [attribute.node, attribute])
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

    // Strategy: Replace the first text/literal node with sorted content and clear all others
    // This handles cases where static classes are split across multiple text nodes by ERB
    let hasUpdated = false
    
    // First pass: determine if we need trailing space by looking for ERB nodes
    let needsTrailingSpace = false
    for (let i = 0; i < attributeValue.children.length; i++) {
      const child = attributeValue.children[i]
      const nextChild = i + 1 < attributeValue.children.length ? attributeValue.children[i + 1] : null
      
      if ((child as any).type === 'AST_HTML_TEXT_NODE' || (child as any).type === 'AST_LITERAL_NODE') {
        const textContent = (child as any).content
        if (textContent && textContent.trim()) {
          // Check if this text node is followed by an ERB node
          if (nextChild && ((nextChild as any).type === 'AST_ERB_CONTENT_NODE' || (nextChild as any).type?.includes('ERB'))) {
            needsTrailingSpace = true
            break
          }
        }
      }
    }
    
    // Second pass: update nodes
    for (let i = 0; i < attributeValue.children.length; i++) {
      const child = attributeValue.children[i]
      
      if ((child as any).type === 'AST_HTML_TEXT_NODE') {
        const textNode = child as HTMLTextNode
        if (textNode.content.trim()) {
          if (!hasUpdated) {
            // First text node with content: replace with sorted classes
            const finalContent = needsTrailingSpace ? sortedContent + ' ' : sortedContent
            
            const newTextNode = Object.assign(Object.create(Object.getPrototypeOf(textNode)), textNode, {
              content: finalContent
            })
            ;(attributeValue.children as any)[i] = newTextNode
            hasUpdated = true
          } else {
            // Subsequent text nodes with content: clear them to avoid duplication
            const emptyTextNode = Object.assign(Object.create(Object.getPrototypeOf(textNode)), textNode, {
              content: ''
            })
            ;(attributeValue.children as any)[i] = emptyTextNode
          }
        }
      } else if ((child as any).type === 'AST_LITERAL_NODE') {
        const literalNode = child as LiteralNode
        if (literalNode.content.trim()) {
          if (!hasUpdated) {
            // First literal node with content: replace with sorted classes
            const finalContent = needsTrailingSpace ? sortedContent + ' ' : sortedContent
            
            const newLiteralNode = Object.assign(Object.create(Object.getPrototypeOf(literalNode)), literalNode, {
              content: finalContent
            })
            ;(attributeValue.children as any)[i] = newLiteralNode
            hasUpdated = true
          } else {
            // Subsequent literal nodes with content: clear them to avoid duplication
            const emptyLiteralNode = Object.assign(Object.create(Object.getPrototypeOf(literalNode)), literalNode, {
              content: ''
            })
            ;(attributeValue.children as any)[i] = emptyLiteralNode
          }
        }
      }
    }
  }
}

/**
 * Options for Tailwind class sorting
 */
export interface TailwindSortOptions {
  enabled?: boolean
  verbose?: boolean
}
