import {
  getStaticAttributeName,
  hasDynamicAttributeName as hasNodeDynamicAttributeName,
  getCombinedAttributeName,
  hasERBOutput,
  getStaticContentFromNodes,
  hasStaticContent,
  isEffectivelyStatic,
  getValidatableStaticContent
} from "@herb-tools/core"

import type {
  ERBContentNode,
  HTMLAttributeNameNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLElementNode,
  HTMLOpenTagNode,
  LiteralNode,
  LexResult,
  Token,
  Node
} from "@herb-tools/core"

import type * as Nodes from "@herb-tools/core"

/**
 * Gets attributes from an HTMLOpenTagNode
 */
export function getAttributes(node: HTMLOpenTagNode): HTMLAttributeNode[] {
  return node.children.filter(node => node.type === "AST_HTML_ATTRIBUTE_NODE") as HTMLAttributeNode[]
}

/**
 * Gets the tag name from an HTML tag node (lowercased)
 */
export function getTagName(node: HTMLElementNode | HTMLOpenTagNode | null | undefined): string | null {
  if (!node) return null

  return node.tag_name?.value.toLowerCase() || null
}

/**
 * Gets the attribute name from an HTMLAttributeNode (lowercased)
 * Returns null if the attribute name contains dynamic content (ERB)
 */
export function getAttributeName(attributeNode: HTMLAttributeNode, lowercase = true): string | null {
  if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
    const nameNode = attributeNode.name as HTMLAttributeNameNode
    const staticName = getStaticAttributeName(nameNode)

    if (!lowercase) return staticName

    return staticName ? staticName.toLowerCase() : null
  }

  return null
}

/**
 * Checks if an attribute has a dynamic (ERB-containing) name
 */
export function hasDynamicAttributeName(attributeNode: HTMLAttributeNode): boolean {
  if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
    const nameNode = attributeNode.name as HTMLAttributeNameNode
    return hasNodeDynamicAttributeName(nameNode)
  }

  return false
}

/**
 * Gets the combined string representation of an attribute name (for debugging)
 * This includes both static content and ERB syntax
 */
export function getCombinedAttributeNameString(attributeNode: HTMLAttributeNode): string {
  if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
    const nameNode = attributeNode.name as HTMLAttributeNameNode

    return getCombinedAttributeName(nameNode)
  }

  return ""
}

/**
 * Gets the attribute value content from an HTMLAttributeValueNode
 */
export function getAttributeValue(attributeNode: HTMLAttributeNode): string | null {
  const valueNode: HTMLAttributeValueNode | null = attributeNode.value as HTMLAttributeValueNode

  if (valueNode === null) return null

  if (valueNode.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE" || !valueNode.children?.length) {
    return null
  }

  let result = ""

  for (const child of valueNode.children) {
    switch (child.type) {
      case "AST_ERB_CONTENT_NODE": {
        const erbNode = child as ERBContentNode

        if (erbNode.content) {
          result += `${erbNode.tag_opening?.value}${erbNode.content.value}${erbNode.tag_closing?.value}`
        }

        break
      }

      case "AST_LITERAL_NODE": {
        result += (child as LiteralNode).content
        break
      }
    }
  }

  return result
}

/**
 * Checks if an attribute has a value
 */
export function hasAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  return attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE"
}

/**
 * Finds an attribute by name in a list of attributes
 */
export function findAttributeByName(attributes: Node[], attributeName: string): HTMLAttributeNode | null {
  for (const child of attributes) {
    if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
      const attributeNode = child as HTMLAttributeNode
      const name = getAttributeName(attributeNode)

      if (name === attributeName.toLowerCase()) {
        return attributeNode
      }
    }
  }

  return null
}

/**
 * Checks if a tag has a specific attribute
 */
export function hasAttribute(node: HTMLOpenTagNode, attributeName: string): boolean {
  return getAttribute(node, attributeName) !== null
}

/**
 * Checks if a tag has a specific attribute
 */
export function getAttribute(node: HTMLOpenTagNode, attributeName: string): HTMLAttributeNode | null {
  const attributes = getAttributes(node)

  return findAttributeByName(attributes, attributeName)
}