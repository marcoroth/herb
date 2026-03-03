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
  HTMLAttributeNode,
  HTMLAttributeNameNode,
  HTMLAttributeValueNode,
  HTMLCommentNode
} from "./nodes.js"

import {
  isAnyOf,
  isLiteralNode,
  isERBNode,
  isERBContentNode,
  isHTMLCommentNode,
  isHTMLElementNode,
  isHTMLOpenTagNode,
  isHTMLAttributeNameNode,
  isHTMLAttributeValueNode,
  areAllOfType,
  filterLiteralNodes,
  filterHTMLAttributeNodes
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

  return node.tag_opening?.value === "<%#" || (node.tag_opening?.value !== "<%#" && (node.content?.value || "").trimStart().startsWith("#"))
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
 * Gets the tag name of an HTML element, open tag, or close tag node.
 * Returns null if the node is null/undefined.
 */
export function getTagName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode): string
export function getTagName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode | null | undefined): string | null
export function getTagName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode | null | undefined): string | null {
  if (!node) return null

  return node.tag_name?.value ?? null
}

/**
 * Gets the lowercased tag name of an HTML element, open tag, or close tag node.
 * Similar to `Element.localName` in the DOM API.
 * Returns null if the node is null/undefined.
 */
export function getTagLocalName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode): string
export function getTagLocalName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode | null | undefined): string | null
export function getTagLocalName(node: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode | null | undefined): string | null {
  return getTagName(node)?.toLowerCase() ?? null
}

/**
 * Check if a node is a comment (HTML comment or ERB comment)
 */
export function isCommentNode(node: Node): node is HTMLCommentNode | ERBCommentNode {
  return isHTMLCommentNode(node) || isERBCommentNode(node)
}

/**
 * Gets the open tag node from an HTMLElementNode, handling both regular and conditional open tags.
 * For conditional open tags, returns null.
 * If given an HTMLOpenTagNode directly, returns it as-is.
 */
export function getOpenTag(node: HTMLElementNode | HTMLOpenTagNode | null | undefined): HTMLOpenTagNode | null {
  if (!node) return null
  if (isHTMLOpenTagNode(node)) return node
  if (isHTMLElementNode(node)) return isHTMLOpenTagNode(node.open_tag) ? node.open_tag : null

  return null
}

/**
 * Gets attributes from an HTMLElementNode or HTMLOpenTagNode
 */
export function getAttributes(node: HTMLElementNode | HTMLOpenTagNode | null | undefined): HTMLAttributeNode[] {
  const openTag = getOpenTag(node)

  return openTag ? filterHTMLAttributeNodes(openTag.children) : []
}

/**
 * Gets the attribute name from an HTMLAttributeNode (lowercased)
 * Returns null if the attribute name contains dynamic content (ERB)
 */
export function getAttributeName(attributeNode: HTMLAttributeNode, lowercase = true): string | null {
  if (!isHTMLAttributeNameNode(attributeNode.name)) return null

  const staticName = getStaticAttributeName(attributeNode.name)

  if (!lowercase) return staticName

  return staticName ? staticName.toLowerCase() : null
}

/**
 * Checks if an attribute value contains only static content (no ERB).
 * Accepts an HTMLAttributeNode directly, or an element/open tag + attribute name.
 * Returns false for null/undefined input.
 */
export function hasStaticAttributeValue(attributeNode: HTMLAttributeNode | null | undefined): boolean
export function hasStaticAttributeValue(node: HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName: string): boolean
export function hasStaticAttributeValue(nodeOrAttribute: HTMLAttributeNode | HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName?: string): boolean {
  const attributeNode = attributeName
    ? getAttribute(nodeOrAttribute as HTMLElementNode | HTMLOpenTagNode, attributeName)
    : nodeOrAttribute as HTMLAttributeNode | null | undefined

  if (!attributeNode?.value?.children) return false

  return attributeNode.value.children.every(isLiteralNode)
}

/**
 * Gets the static string value of an attribute (returns null if it contains ERB).
 * Accepts an HTMLAttributeNode directly, or an element/open tag + attribute name.
 * Returns null for null/undefined input.
 */
export function getStaticAttributeValue(attributeNode: HTMLAttributeNode | null | undefined): string | null
export function getStaticAttributeValue(node: HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName: string): string | null
export function getStaticAttributeValue(nodeOrAttribute: HTMLAttributeNode | HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName?: string): string | null {
  const attributeNode = attributeName
    ? getAttribute(nodeOrAttribute as HTMLElementNode | HTMLOpenTagNode, attributeName)
    : nodeOrAttribute as HTMLAttributeNode | null | undefined

  if (!attributeNode) return null
  if (!hasStaticAttributeValue(attributeNode)) return null

  const valueNode = attributeNode.value
  if (!valueNode) return null

  return filterLiteralNodes(valueNode.children).map(child => child.content).join("") || ""
}

/**
 * Splits a space-separated attribute value into individual tokens.
 * Accepts a string, or an element/open tag + attribute name to look up.
 * Returns an empty array for null/undefined/empty input.
 */
export function getTokenList(value: string | null | undefined): string[]
export function getTokenList(node: HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName: string): string[]
export function getTokenList(valueOrNode: string | HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName?: string): string[] {
  const value = attributeName
    ? getStaticAttributeValue(valueOrNode as HTMLElementNode | HTMLOpenTagNode, attributeName)
    : valueOrNode as string | null | undefined

  if (!value) return []

  return value.trim().split(/\s+/).filter(token => token.length > 0)
}

/**
 * Finds an attribute by name in a list of attribute nodes
 */
export function findAttributeByName(attributes: Node[], attributeName: string): HTMLAttributeNode | null {
  for (const attribute of filterHTMLAttributeNodes(attributes)) {
    const name = getAttributeName(attribute)

    if (name === attributeName.toLowerCase()) {
      return attribute
    }
  }

  return null
}

/**
 * Gets a specific attribute from an HTMLElementNode or HTMLOpenTagNode by name
 */
export function getAttribute(node: HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName: string): HTMLAttributeNode | null {
  const attributes = getAttributes(node)

  return findAttributeByName(attributes, attributeName)
}

/**
 * Checks if an element or open tag has a specific attribute
 */
export function hasAttribute(node: HTMLElementNode | HTMLOpenTagNode | null | undefined, attributeName: string): boolean {
  if (!node) return false

  return getAttribute(node, attributeName) !== null
}

/**
 * Checks if an attribute has a dynamic (ERB-containing) name.
 * Accepts an HTMLAttributeNode (wraps the core HTMLAttributeNameNode-level check).
 */
export function hasDynamicAttributeNameOnAttribute(attributeNode: HTMLAttributeNode): boolean {
  if (!isHTMLAttributeNameNode(attributeNode.name)) return false

  return hasDynamicAttributeName(attributeNode.name)
}

/**
 * Gets the combined string representation of an attribute name (including ERB syntax).
 * Accepts an HTMLAttributeNode (wraps the core HTMLAttributeNameNode-level check).
 */
export function getCombinedAttributeNameString(attributeNode: HTMLAttributeNode): string {
  if (!isHTMLAttributeNameNode(attributeNode.name)) return ""

  return getCombinedAttributeName(attributeNode.name)
}

/**
 * Checks if an attribute value contains dynamic content (ERB)
 */
export function hasDynamicAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  if (!attributeNode.value?.children) return false

  return attributeNode.value.children.some(isERBContentNode)
}

/**
 * Gets the value nodes array from an attribute for dynamic inspection
 */
export function getAttributeValueNodes(attributeNode: HTMLAttributeNode): Node[] {
  return attributeNode.value?.children || []
}

/**
 * Checks if an attribute value contains any static content (for validation purposes)
 */
export function hasStaticAttributeValueContent(attributeNode: HTMLAttributeNode): boolean {
  return hasStaticContent(getAttributeValueNodes(attributeNode))
}

/**
 * Gets the static content of an attribute value (all literal parts combined).
 * Unlike getStaticAttributeValue, this extracts only the static portions from mixed content.
 * Returns the concatenated literal content, or null if no literal nodes exist.
 */
export function getStaticAttributeValueContent(attributeNode: HTMLAttributeNode): string | null {
  return getStaticContentFromNodes(getAttributeValueNodes(attributeNode))
}

/**
 * Gets the combined attribute value including both static text and ERB tag syntax.
 * For ERB nodes, includes the full tag syntax (e.g., "<%= foo %>").
 * Returns null if the attribute has no value.
 */
export function getAttributeValue(attributeNode: HTMLAttributeNode): string | null {
  const valueNode = attributeNode.value
  if (!valueNode) return null

  if (valueNode.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE" || !valueNode.children?.length) {
    return null
  }

  let result = ""

  for (const child of valueNode.children) {
    if (isERBContentNode(child)) {
      if (child.content) {
        result += `${child.tag_opening?.value}${child.content.value}${child.tag_closing?.value}`
      }
    } else if (isLiteralNode(child)) {
      result += child.content
    }
  }

  return result
}

/**
 * Checks if an attribute has a value node
 */
export function hasAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  return isHTMLAttributeValueNode(attributeNode.value)
}

/**
 * Gets the quote type used for an attribute value
 */
export function getAttributeValueQuoteType(node: HTMLAttributeNode | HTMLAttributeValueNode): "single" | "double" | "none" | null {
  const valueNode = isHTMLAttributeValueNode(node) ? node : node.value
  if (!valueNode) return null

  if (valueNode.quoted && valueNode.open_quote) {
    return valueNode.open_quote.value === '"' ? "double" : "single"
  }

  return "none"
}

/**
 * Checks if an attribute value is quoted
 */
export function isAttributeValueQuoted(attributeNode: HTMLAttributeNode): boolean {
  if (!isHTMLAttributeValueNode(attributeNode.value)) return false

  return !!attributeNode.value.quoted
}

/**
 * Iterates over all attributes of an element or open tag node
 */
export function forEachAttribute(node: HTMLElementNode | HTMLOpenTagNode, callback: (attributeNode: HTMLAttributeNode) => void): void {
  for (const attribute of getAttributes(node)) {
    callback(attribute)
  }
}

// --- Position Utilities ---

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
