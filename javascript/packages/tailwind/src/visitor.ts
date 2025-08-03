import { Visitor } from "@herb-tools/core"
import {
  Node,
  HTMLElementNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLAttributeNameNode,
  HTMLTextNode,
  LiteralNode,
  ERBContentNode,
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
          sortedContent: null // Will be filled later
        })
        console.log(`[Tailwind] Added class attribute: "${classContent}", total: ${this.classAttributes.length}`)
      } else {
        console.log(`[Tailwind] Skipped class attribute - content: ${JSON.stringify(classContent)}, hasTailwind: ${classContent ? containsTailwindClasses(classContent) : 'N/A'}`)
      }
    }

    // Continue visiting children
    super.visitHTMLAttributeNode(node)
  }

  /**
   * Override the main visit method to ensure we catch all node types
   */
  visit(node: Node | null | undefined): void {
    if (!node) return;
    
    const nodeType = (node as any).type;
    console.log(`[Tailwind] Visiting node type: ${nodeType}`);
    
    if (nodeType === 'AST_HTML_OPEN_TAG_NODE') {
      this.visitHTMLOpenTagNode(node as HTMLOpenTagNode);
    } else if (nodeType === 'AST_HTML_SELF_CLOSE_TAG_NODE') {
      this.visitHTMLSelfCloseTagNode(node as HTMLSelfCloseTagNode);
    } else {
      // Call parent implementation for other node types
      super.visit(node);
    }
  }

  /**
   * Visit HTML open tag nodes and manually check their children for attributes
   */
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    console.log(`[Tailwind] Visiting HTML open tag, children count: ${node.children?.length}`)
    // Manually visit attribute nodes since they're not automatically traversed
    const attributes = node.children.filter((child: Node): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
    
    console.log(`[Tailwind] Found ${attributes.length} attributes`)
    attributes.forEach((attr, i) => {
      console.log(`[Tailwind] Processing attribute ${i}:`, (attr.name as any)?.name?.value)
      this.visitHTMLAttributeNode(attr)
    })

    // Continue with default behavior for children
    super.visitHTMLOpenTagNode(node)
  }

  /**
   * Visit HTML self-close tag nodes and manually check their attributes
   */
  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    // Manually visit attribute nodes
    const attributes = node.attributes.filter((child: Node): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
    
    attributes.forEach(attr => this.visitHTMLAttributeNode(attr))

    // Continue with default behavior
    super.visitHTMLSelfCloseTagNode(node)
  }

  /**
   * Extract the text content from a class attribute
   */
  private extractClassContent(attribute: HTMLAttributeNode): string | null {
    if (!attribute.value || (attribute.value as any).type !== 'AST_HTML_ATTRIBUTE_VALUE_NODE') {
      console.log(`[Tailwind] No value: ${JSON.stringify(!attribute.value)}, wrong type: ${(attribute.value as any)?.type}`)
      return null
    }

    const attributeValue = attribute.value as HTMLAttributeValueNode
    let classContent = ""

    for (const child of attributeValue.children) {
      if ((child as any).type === 'AST_HTML_TEXT_NODE') {
        classContent += (child as HTMLTextNode).content
        console.log(`[Tailwind] Added HTML text: "${(child as HTMLTextNode).content}"`)
      } else if ((child as any).type === 'AST_LITERAL_NODE') {
        classContent += (child as LiteralNode).content
        console.log(`[Tailwind] Added literal: "${(child as LiteralNode).content}"`)
      } else {
        console.log(`[Tailwind] Ignored child type: ${(child as any).type}`)
      }
      // Note: We ignore ERB content for now as it's dynamic
    }

    const result = classContent.trim() || null
    console.log(`[Tailwind] Final extracted content: ${JSON.stringify(result)}`)
    return result
  }

  /**
   * Sort all collected class attributes
   */
  async sortAllClassAttributes(): Promise<void> {
    const sortPromises = this.classAttributes.map(async (classAttr) => {
      if (classAttr.originalContent) {
        classAttr.sortedContent = await sortTailwindClasses(classAttr.originalContent)
      }
    })

    await Promise.all(sortPromises)
  }

  /**
   * Check if any class attributes were modified
   */
  hasModifications(): boolean {
    return this.classAttributes.some(attr => 
      attr.sortedContent !== null && 
      attr.sortedContent !== attr.originalContent
    )
  }

  /**
   * Get statistics about the sorting operation
   */
  getStatistics(): { total: number, modified: number, skipped: number } {
    const total = this.classAttributes.length
    const modified = this.classAttributes.filter(attr => 
      attr.sortedContent !== null && 
      attr.sortedContent !== attr.originalContent
    ).length
    
    return {
      total,
      modified,
      skipped: total - modified
    }
  }
}