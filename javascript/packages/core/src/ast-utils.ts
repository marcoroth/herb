import {
  Node,
  LiteralNode,
  ERBNode,
  ERBContentNode,
  ERBIfNode,
  ERBUnlessNode,
  ERBBlockNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBWhileNode,
  ERBForNode,
  ERBBeginNode,
  HTMLElementNode,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLAttributeNameNode,
  HTMLCommentNode
} from "./nodes.js"

import {
  isAnyOf,
  isLiteralNode,
  isERBNode,
  isERBContentNode,
  isHTMLCommentNode,
  areAllOfType,
  filterLiteralNodes
} from "./node-type-guards.js"

import type { Location } from "./location.js"
import type { Position } from "./position.js"

export type ERBOutputNode = ERBNode & {
  tag_opening: {
    value: "<%=" | "<%=="
  }
}

export type ERBCommentNode = ERBNode & {
  tag_opening: {
    value: "<%#"
  }
}

/**
 * Checks if a node is an ERB output node (generates content: <%= %> or <%== %>)
 */
export function isERBOutputNode(node: Node): node is ERBOutputNode {
  if (!isERBNode(node)) return false
  if (!node.tag_opening?.value) return false

  return ["<%=", "<%=="].includes(node.tag_opening?.value)
}

/**
 * Checks if a node is a ERB comment node (control flow: <%# %>)
 */
export function isERBCommentNode(node: Node): node is ERBCommentNode {
  if (!isERBNode(node)) return false
  if (!node.tag_opening?.value) return false

  return node.tag_opening?.value === "<%#" || (node.tag_opening?.value !== "<%#" && (node.content?.value || "").trimStart().startsWith("#"))
}


/**
 * Checks if a node is a non-output ERB node (control flow: <% %>)
 */
export function isERBControlFlowNode(node: Node): node is ERBContentNode {
  return isAnyOf(node, ERBIfNode, ERBUnlessNode, ERBBlockNode, ERBCaseNode, ERBCaseMatchNode, ERBWhileNode, ERBForNode, ERBBeginNode)
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

/**
 * Gets the tag name of an HTML element node
 */
export function getTagName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode): string {
  return node.tag_name?.value ?? ""
}

/**
 * Check if a node is a comment (HTML comment or ERB comment)
 */
export function isCommentNode(node: Node): node is HTMLCommentNode | ERBCommentNode {
  return isHTMLCommentNode(node) || isERBCommentNode(node)
}

/**
 * Compares two positions to determine if the first comes before the second
 * Returns true if pos1 comes before pos2 in source order
 * @param inclusive - If true, returns true when positions are equal
 */
function isPositionBefore(position1: Position, position2: Position, inclusive = false): boolean {
  if (position1.line < position2.line) return true
  if (position1.line > position2.line) return false

  return inclusive ? position1.column <= position2.column : position1.column < position2.column
}

/**
 * Compares two positions to determine if they are equal
 * Returns true if pos1 and pos2 are at the same location
 */
export function isPositionEqual(position1: Position, position2: Position): boolean {
  return position1.line === position2.line && position1.column === position2.column
}

/**
 * Compares two positions to determine if the first comes after the second
 * Returns true if pos1 comes after pos2 in source order
 * @param inclusive - If true, returns true when positions are equal
 */
export function isPositionAfter(position1: Position, position2: Position, inclusive = false): boolean {
  if (position1.line > position2.line) return true
  if (position1.line < position2.line) return false

  return inclusive ? position1.column >= position2.column : position1.column > position2.column
}

/**
 * Gets nodes that appear before the specified location in source order
 * Uses line and column positions to determine ordering
 */
export function getNodesBeforeLocation<T extends Node>(nodes: T[], location: Location): T[] {
  return nodes.filter(node =>
    node.location && isPositionBefore(node.location.end, location.start)
  )
}

/**
 * Gets nodes that appear after the specified location in source order
 * Uses line and column positions to determine ordering
 */
export function getNodesAfterLocation<T extends Node>(nodes: T[], location: Location): T[] {
  return nodes.filter(node =>
    node.location && isPositionAfter(node.location.start, location.end)
  )
}

/**
 * Splits nodes into before and after the specified location
 * Returns an object with `before` and `after` arrays
 */
export function splitNodesAroundLocation<T extends Node>(nodes: T[], location: Location): { before: T[], after: T[] } {
  return {
    before: getNodesBeforeLocation(nodes, location),
    after: getNodesAfterLocation(nodes, location)
  }
}

/**
 * Splits nodes at a specific position
 * Returns nodes that end before the position and nodes that start after the position
 * More precise than splitNodesAroundLocation as it uses a single position point
 * Uses the same defaults as the individual functions: before=exclusive, after=inclusive
 */
export function splitNodesAroundPosition<T extends Node>(nodes: T[], position: Position): { before: T[], after: T[] } {
  return {
    before: getNodesBeforePosition(nodes, position), // uses default: inclusive = false
    after: getNodesAfterPosition(nodes, position)    // uses default: inclusive = true
  }
}

/**
 * Gets nodes that end before the specified position
 * @param inclusive - If true, includes nodes that end exactly at the position (default: false, matching half-open interval semantics)
 */
export function getNodesBeforePosition<T extends Node>(nodes: T[], position: Position, inclusive = false): T[] {
  return nodes.filter(node =>
    node.location && isPositionBefore(node.location.end, position, inclusive)
  )
}

/**
 * Gets nodes that start after the specified position
 * @param inclusive - If true, includes nodes that start exactly at the position (default: true, matching typical boundary behavior)
 */
export function getNodesAfterPosition<T extends Node>(nodes: T[], position: Position, inclusive = true): T[] {
  return nodes.filter(node =>
    node.location && isPositionAfter(node.location.start, position, inclusive)
  )
}
