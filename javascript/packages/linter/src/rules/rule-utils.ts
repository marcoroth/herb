import {
  HTMLOpenTagNode,
  HTMLSelfCloseTagNode,
  HTMLAttributeNode,
  HTMLAttributeNameNode,
  HTMLAttributeValueNode,
  LiteralNode,
  Visitor,
  Location,
  Node,
} from "@herb-tools/core"
import type { ERBBlockNode } from "@herb-tools/core"
import type { LintMessage } from "../types.js"

/**
 * Base visitor class that provides common functionality for rule visitors
 */
export abstract class BaseRuleVisitor extends Visitor {
  public messages: LintMessage[] = []
  protected ruleName: string

  constructor(ruleName: string) {
    super()

    this.ruleName = ruleName
  }

  /**
   * Helper method to create a lint message
   */
  protected createMessage(message: string, location: Location, severity: "error" | "warning" = "error"): LintMessage {
    return {
      rule: this.ruleName,
      message,
      location,
      severity
    }
  }
  /**
   * Visits child nodes and records the node type in the visited array
   */
  visitChildNodes(node: Node): void {
    super.visitChildNodes(node)
  }

  /**
   * Helper method to add a message to the messages array
   */
  protected addMessage(message: string, location: Location, severity: "error" | "warning" = "error"): void {
    this.messages.push(this.createMessage(message, location, severity))
  }
}

/**
 * Gets attributes from either an HTMLOpenTagNode or HTMLSelfCloseTagNode
 */
export function getAttributes(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): any[] {
  return node.type === "AST_HTML_SELF_CLOSE_TAG_NODE"
    ? (node as HTMLSelfCloseTagNode).attributes
    : (node as HTMLOpenTagNode).children
}

/**
 * Checks if a node is an ERB node
 */
export function isERBNode(node: Node): node is ERBBlockNode {
  return node.constructor.name.startsWith("ERB")
}

/**
 * Gets the tag name from an HTML tag node (lowercased)
 */
export function getTagName(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): string | null {
  return node.tag_name?.value.toLowerCase() || null
}

/**
 * Gets the attribute name from an HTMLAttributeNode (lowercased)
 */
export function getAttributeName(attributeNode: HTMLAttributeNode): string | null {
  if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
    const nameNode = attributeNode.name as HTMLAttributeNameNode

    return nameNode.name?.value.toLowerCase() || null
  }

  return null
}

/**
 * Gets the attribute value content from an HTMLAttributeValueNode
 */
export function getAttributeValue(attributeNode: HTMLAttributeNode): string | null {
  if (attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
    const valueNode = attributeNode.value as HTMLAttributeValueNode

    if (valueNode.children && valueNode.children.length > 0) {
      return valueNode.children
        .filter(child => child.type === "AST_LITERAL_NODE")
        .map(child => (child as LiteralNode).content)
        .join("")
    }
  }

  return null
}

/**
 * Checks if an attribute has a value
 */
export function hasAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  return attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE"
}

/**
 * Gets the quote type used for an attribute value
 */
export function getAttributeValueQuoteType(attributeNode: HTMLAttributeNode): "single" | "double" | "none" | null {
  if (attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
    const valueNode = attributeNode.value as HTMLAttributeValueNode
    if (valueNode.quoted && valueNode.open_quote) {
      return valueNode.open_quote.value === '"' ? "double" : "single"
    }

    return "none"
  }

  return null
}

/**
 * Finds an attribute by name in a list of attributes
 */
export function findAttributeByName(attributes: any[], attributeName: string): HTMLAttributeNode | null {
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
export function hasAttribute(node: HTMLOpenTagNode | HTMLSelfCloseTagNode, attributeName: string): boolean {
  const attributes = getAttributes(node)
  return findAttributeByName(attributes, attributeName) !== null
}

/**
 * Common HTML element categorization
 */
export const HTML_INLINE_ELEMENTS = new Set([
  "a", "abbr", "acronym", "b", "bdo", "big", "br", "button", "cite", "code",
  "dfn", "em", "i", "img", "input", "kbd", "label", "map", "object", "output",
  "q", "samp", "script", "select", "small", "span", "strong", "sub", "sup",
  "textarea", "time", "tt", "var"
])

export const HTML_BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "canvas", "dd", "div", "dl",
  "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2",
  "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "noscript",
  "ol", "p", "pre", "section", "table", "tfoot", "ul", "video"
])

export const HTML_BOOLEAN_ATTRIBUTES = new Set([
  "autofocus", "autoplay", "checked", "controls", "defer", "disabled", "hidden",
  "loop", "multiple", "muted", "readonly", "required", "reversed", "selected",
  "open", "default", "formnovalidate", "novalidate", "itemscope", "scoped",
  "seamless", "allowfullscreen", "async", "compact", "declare", "nohref",
  "noresize", "noshade", "nowrap", "sortable", "truespeed", "typemustmatch"
])

export const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/**
 * Checks if an element is inline
 */
export function isInlineElement(tagName: string): boolean {
  return HTML_INLINE_ELEMENTS.has(tagName.toLowerCase())
}

/**
 * Checks if an element is block-level
 */
export function isBlockElement(tagName: string): boolean {
  return HTML_BLOCK_ELEMENTS.has(tagName.toLowerCase())
}

/**
 * Checks if an attribute is a boolean attribute
 */
export function isBooleanAttribute(attributeName: string): boolean {
  return HTML_BOOLEAN_ATTRIBUTES.has(attributeName.toLowerCase())
}

/**
 * Abstract base class for rules that need to check individual attributes on HTML tags
 * Eliminates duplication of visitHTMLOpenTagNode/visitHTMLSelfCloseTagNode patterns
 * and attribute iteration logic. Provides simplified interface with extracted attribute info.
 */
export abstract class AttributeVisitorMixin extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAttributesOnNode(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkAttributesOnNode(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkAttributesOnNode(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    forEachAttribute(node, (attributeNode) => {
      const attributeName = getAttributeName(attributeNode)
      const attributeValue = getAttributeValue(attributeNode)

      if (attributeName) {
        this.checkAttribute(attributeName, attributeValue, attributeNode, node)
      }
    })
  }

  protected abstract checkAttribute(
    attributeName: string,
    attributeValue: string | null,
    attributeNode: HTMLAttributeNode,
    parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode
  ): void
}

/**
 * Checks if an attribute value is quoted
 */
export function isAttributeValueQuoted(attributeNode: HTMLAttributeNode): boolean {
  if (attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
    const valueNode = attributeNode.value as HTMLAttributeValueNode

    return !!valueNode.quoted
  }

  return false
}

/**
 * Iterates over all attributes of a tag node, calling the callback for each attribute
 */
export function forEachAttribute(
  node: HTMLOpenTagNode | HTMLSelfCloseTagNode,
  callback: (attributeNode: HTMLAttributeNode) => void
): void {
  const attributes = getAttributes(node)

  for (const child of attributes) {
    if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
      callback(child as HTMLAttributeNode)
    }
  }
}
