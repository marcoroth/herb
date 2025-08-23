import { LiteralNode } from "./nodes.js"

import {
  isLiteralNode,
  isERBContentNode,
  areAllOfType,
  filterLiteralNodes
} from "./node-type-guards.js"

import type { Node, ERBContentNode, HTMLAttributeNameNode } from "./nodes.js"

/**
 * Checks if a node is an ERB output node (generates content: <%= %> or <%== %>)
 */
export function isERBOutputNode(node: Node): node is ERBContentNode {
  if (!isERBContentNode(node)) return false

  const erbNode = node as ERBContentNode
  const opening = erbNode.tag_opening?.value

  return opening === "<%=" || opening === "<%=="
}

/**
 * Checks if a node is a non-output ERB node (control flow: <% %>)
 */
export function isERBControlNode(node: Node): node is ERBContentNode {
  if (!isERBContentNode(node)) return false

  const erbNode = node as ERBContentNode

  return erbNode.tag_opening?.value === "<%"
}

/**
 * Checks if an array of nodes contains any ERB content nodes
 */
export function hasERBContent(nodes: Node[]): boolean {
  return nodes.some(isERBContentNode)
}

/**
 * Checks if an array of nodes contains any ERB output nodes (dynamic content)
 */
export function hasERBOutput(nodes: Node[]): boolean {
  return nodes.some(isERBOutputNode)
}


/**
 * Extracts a static string from an array of literal nodes
 * Returns null if any node is not a literal node
 */
export function getStaticStringFromNodes(nodes: Node[]): string | null {
  if (!areAllOfType(nodes, LiteralNode)) {
    return null
  }

  return nodes.map(node => node.content).join("")
}

/**
 * Extracts static content from nodes, including mixed literal/ERB content
 * Returns the concatenated literal content, or null if no literal nodes exist
 */
export function getStaticContentFromNodes(nodes: Node[]): string | null {
  const literalNodes = filterLiteralNodes(nodes)

  if (literalNodes.length === 0) {
    return null
  }

  return literalNodes.map(node => node.content).join("")
}

/**
 * Checks if nodes contain any literal content (for static validation)
 */
export function hasStaticContent(nodes: Node[]): boolean {
  return nodes.some(isLiteralNode)
}

/**
 * Checks if nodes are effectively static (only literals and non-output ERB)
 * Non-output ERB like <% if %> doesn't affect static validation
 */
export function isEffectivelyStatic(nodes: Node[]): boolean {
  return !hasERBOutput(nodes)
}

/**
 * Gets static-validatable content from nodes (ignores control ERB, includes literals)
 * Returns concatenated literal content for validation, or null if contains output ERB
 */
export function getValidatableStaticContent(nodes: Node[]): string | null {
  if (hasERBOutput(nodes)) {
    return null
  }

  return filterLiteralNodes(nodes).map(node => node.content).join("")
}

/**
 * Extracts a combined string from nodes, including ERB content
 * For ERB nodes, includes the full tag syntax (e.g., "<%= foo %>")
 * This is useful for debugging or displaying the full attribute name
 */
export function getCombinedStringFromNodes(nodes: Node[]): string {
  return nodes.map(node => {
    if (isLiteralNode(node)) {
      return node.content
    } else if (isERBContentNode(node)) {
      const opening = node.tag_opening?.value || ""
      const content = node.content?.value || ""
      const closing = node.tag_closing?.value || ""

      return `${opening}${content}${closing}`
    } else {
      // For other node types, return a placeholder or empty string
      return `[${node.type}]`
    }
  }).join("")
}

/**
 * Checks if an HTML attribute name node has a static (literal-only) name
 */
export function hasStaticAttributeName(attributeNameNode: HTMLAttributeNameNode): boolean {
  if (!attributeNameNode.children) {
    return false
  }

  return areAllOfType(attributeNameNode.children, LiteralNode)
}

/**
 * Checks if an HTML attribute name node has dynamic content (contains ERB)
 */
export function hasDynamicAttributeName(attributeNameNode: HTMLAttributeNameNode): boolean {
  if (!attributeNameNode.children) {
    return false
  }

  return hasERBContent(attributeNameNode.children)
}

/**
 * Gets the static string value of an HTML attribute name node
 * Returns null if the attribute name contains dynamic content (ERB)
 */
export function getStaticAttributeName(attributeNameNode: HTMLAttributeNameNode): string | null {
  if (!attributeNameNode.children) {
    return null
  }

  return getStaticStringFromNodes(attributeNameNode.children)
}

/**
 * Gets the combined string representation of an HTML attribute name node
 * This includes both static and dynamic content, useful for debugging
 */
export function getCombinedAttributeName(attributeNameNode: HTMLAttributeNameNode): string {
  if (!attributeNameNode.children) {
    return ""
  }

  return getCombinedStringFromNodes(attributeNameNode.children)
}
