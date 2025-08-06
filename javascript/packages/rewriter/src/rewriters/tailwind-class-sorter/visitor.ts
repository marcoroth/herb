import { Visitor } from "@herb-tools/core"
import {
  Node,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLAttributeNameNode,
  HTMLTextNode,
  LiteralNode,
  HTMLOpenTagNode,
  HTMLSelfCloseTagNode,
} from "@herb-tools/core"

import { sortTailwindClasses, containsTailwindClasses } from "./sorter.js"

/**
 * Represents a class attribute that needs to be sorted
 */
export interface ClassAttribute {
  node: HTMLAttributeNode
  originalContent: string
  sortedContent: string | null
}

/**
 * Visitor that finds all class attributes and prepares them for sorting
 */
export class TailwindVisitor extends Visitor {
  private classAttributes: ClassAttribute[] = []
  private sortEnabled: boolean

  constructor(sortEnabled: boolean = true) {
    super()
    this.sortEnabled = sortEnabled
  }

  /**
   * Get all found class attributes
   */
  getClassAttributes(): ClassAttribute[] {
    return this.classAttributes
  }

  /**
   * Visit HTML attribute nodes to find class attributes
   */
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const name = (node.name as HTMLAttributeNameNode)?.name?.value ?? ""

    if (name === 'class' && node.value && this.sortEnabled) {
      const classContent = this.extractClassContent(node)

      if (classContent && containsTailwindClasses(classContent)) {
        this.classAttributes.push({
          node,
          originalContent: classContent,
          sortedContent: null
        })
      }
    }

    super.visitHTMLAttributeNode(node)
  }

  /**
   * Override the main visit method to ensure we catch all node types
   */
  visit(node: Node | null | undefined): void {
    if (!node) return;

    const nodeType = (node as any).type;

    if (nodeType === 'AST_HTML_OPEN_TAG_NODE') {
      this.visitHTMLOpenTagNode(node as HTMLOpenTagNode);
    } else if (nodeType === 'AST_HTML_SELF_CLOSE_TAG_NODE') {
      this.visitHTMLSelfCloseTagNode(node as HTMLSelfCloseTagNode);
    } else {
      super.visit(node);
    }
  }

  /**
   * Visit HTML open tag nodes and manually check their children for attributes
   */
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const attributes = node.children.filter((child: Node): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )

    attributes.forEach(attribute => {
      this.visitHTMLAttributeNode(attribute)
    })

    super.visitHTMLOpenTagNode(node)
  }

  /**
   * Visit HTML self-close tag nodes and manually check their attributes
   */
  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    const attributes = node.attributes.filter((child: Node): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )

    attributes.forEach(attribute => this.visitHTMLAttributeNode(attribute))

    super.visitHTMLSelfCloseTagNode(node)
  }

  /**
   * Extract the text content from a class attribute
   * Only extract from text/literal nodes, ignoring ERB content
   */
  private extractClassContent(attribute: HTMLAttributeNode): string | null {
    if (!attribute.value || (attribute.value as any).type !== 'AST_HTML_ATTRIBUTE_VALUE_NODE') {
      return null
    }

    const attributeValue = attribute.value as HTMLAttributeValueNode
    const textParts: string[] = []

    for (const child of attributeValue.children) {
      if ((child as any).type === 'AST_HTML_TEXT_NODE') {
        const content = (child as HTMLTextNode).content.trim()
        if (content) {
          textParts.push(content)
        }
      } else if ((child as any).type === 'AST_LITERAL_NODE') {
        const content = (child as LiteralNode).content.trim()
        if (content) {
          textParts.push(content)
        }
      }
      // Ignore ERB content nodes - they will be preserved as-is
    }

    // Join all text parts with single spaces
    return textParts.join(' ').trim() || null
  }

  /**
   * Sort all collected class attributes
   */
  sortAllClassAttributes(): void {
    this.classAttributes.forEach((classAttribute) => {
      if (classAttribute.originalContent) {
        classAttribute.sortedContent = sortTailwindClasses(classAttribute.originalContent)
      }
    })
  }

  /**
   * Check if any class attributes were modified
   */
  hasModifications(): boolean {
    return this.classAttributes.some(attribute =>
      attribute.sortedContent !== null &&
      attribute.sortedContent !== attribute.originalContent
    )
  }

  /**
   * Get statistics about the sorting operation
   */
  getStatistics(): { total: number, modified: number, skipped: number } {
    const total = this.classAttributes.length
    const modified = this.classAttributes.filter(attribute =>
      attribute.sortedContent !== null &&
      attribute.sortedContent !== attribute.originalContent
    ).length

    return {
      total,
      modified,
      skipped: total - modified
    }
  }
}
