import {
  Visitor,
  Position,
  Location,
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
  ERBNode,
  HTMLAttributeNameNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLOpenTagNode,
  LiteralNode,
  LexResult,
  Token,
  Node
} from "@herb-tools/core"

import { IdentityPrinter } from "@herb-tools/printer"

import { DEFAULT_LINT_CONTEXT } from "../types.js"

import type * as Nodes from "@herb-tools/core"
import type { LintOffense, LintSeverity, LintContext } from "../types.js"

export enum ControlFlowType {
  CONDITIONAL,
  LOOP
}

/**
 * Base visitor class that provides common functionality for rule visitors
 */
export abstract class BaseRuleVisitor extends Visitor {
  public readonly offenses: LintOffense[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    super()

    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create a lint offense
   */
  protected createOffense(message: string, location: Location, severity: LintSeverity = "error"): LintOffense {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      severity,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, severity: LintSeverity = "error"): void {
    this.offenses.push(this.createOffense(message, location, severity))
  }
}

/**
 * Mixin that adds control flow tracking capabilities to rule visitors
 * This allows rules to track state across different control flow structures
 * like if/else branches, loops, etc.
 *
 * @template TControlFlowState - Type for state passed between onEnterControlFlow and onExitControlFlow
 * @template TBranchState - Type for state passed between onEnterBranch and onExitBranch
 */
export abstract class ControlFlowTrackingVisitor<TControlFlowState = any, TBranchState = any> extends BaseRuleVisitor {
  protected isInControlFlow: boolean = false
  protected currentControlFlowType: ControlFlowType | null = null

  /**
   * Handle visiting a control flow node with proper scope management
   */
  protected handleControlFlowNode(node: Node, controlFlowType: ControlFlowType, visitChildren: () => void): void {
    const wasInControlFlow = this.isInControlFlow
    const previousControlFlowType = this.currentControlFlowType

    this.isInControlFlow = true
    this.currentControlFlowType = controlFlowType

    const stateToRestore = this.onEnterControlFlow(controlFlowType, wasInControlFlow)

    visitChildren()

    this.onExitControlFlow(controlFlowType, wasInControlFlow, stateToRestore)

    this.isInControlFlow = wasInControlFlow
    this.currentControlFlowType = previousControlFlowType
  }

  /**
   * Handle visiting a branch node (like else, when) with proper scope management
   */
  protected startNewBranch(visitChildren: () => void): void {
    const stateToRestore = this.onEnterBranch()

    visitChildren()

    this.onExitBranch(stateToRestore)
  }

  visitERBIfNode(node: Nodes.ERBIfNode): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => super.visitERBIfNode(node))
  }

  visitERBUnlessNode(node: Nodes.ERBUnlessNode): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => super.visitERBUnlessNode(node))
  }

  visitERBCaseNode(node: Nodes.ERBCaseNode): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => super.visitERBCaseNode(node))
  }

  visitERBCaseMatchNode(node: Nodes.ERBCaseMatchNode): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => super.visitERBCaseMatchNode(node))
  }

  visitERBWhileNode(node: Nodes.ERBWhileNode): void {
    this.handleControlFlowNode(node, ControlFlowType.LOOP, () => super.visitERBWhileNode(node))
  }

  visitERBForNode(node: Nodes.ERBForNode): void {
    this.handleControlFlowNode(node, ControlFlowType.LOOP, () => super.visitERBForNode(node))
  }

  visitERBUntilNode(node: Nodes.ERBUntilNode): void {
    this.handleControlFlowNode(node, ControlFlowType.LOOP, () => super.visitERBUntilNode(node))
  }

  visitERBBlockNode(node: Nodes.ERBBlockNode): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => super.visitERBBlockNode(node))
  }

  visitERBElseNode(node: Nodes.ERBElseNode): void {
    this.startNewBranch(() => super.visitERBElseNode(node))
  }

  visitERBWhenNode(node: Nodes.ERBWhenNode): void {
    this.startNewBranch(() => super.visitERBWhenNode(node))
  }

  protected abstract onEnterControlFlow(controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean): TControlFlowState
  protected abstract onExitControlFlow(controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean, stateToRestore: TControlFlowState): void
  protected abstract onEnterBranch(): TBranchState
  protected abstract onExitBranch(stateToRestore: TBranchState): void
}

/**
 * Gets attributes from an HTMLOpenTagNode
 */
export function getAttributes(node: HTMLOpenTagNode): HTMLAttributeNode[] {
  return node.children.filter(node => node.type === "AST_HTML_ATTRIBUTE_NODE") as HTMLAttributeNode[]
}

/**
 * Gets the tag name from an HTML tag node (lowercased)
 */
export function getTagName(node: HTMLOpenTagNode): string | null {
  return node.tag_name?.value.toLowerCase() || null
}

/**
 * Gets the attribute name from an HTMLAttributeNode (lowercased)
 * Returns null if the attribute name contains dynamic content (ERB)
 */
export function getAttributeName(attributeNode: HTMLAttributeNode): string | null {
  if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
    const nameNode = attributeNode.name as HTMLAttributeNameNode
    const staticName = getStaticAttributeName(nameNode)

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
 * Checks if an attribute value contains only static content (no ERB)
 */
export function hasStaticAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  const valueNode = attributeNode.value as HTMLAttributeValueNode | null

  if (!valueNode?.children) return false

  return valueNode.children.every(child => child.type === "AST_LITERAL_NODE")
}

/**
 * Checks if an attribute value contains dynamic content (ERB)
 */
export function hasDynamicAttributeValue(attributeNode: HTMLAttributeNode): boolean {
  const valueNode = attributeNode.value as HTMLAttributeValueNode | null

  if (!valueNode?.children) return false

  return valueNode.children.some(child => child.type === "AST_ERB_CONTENT_NODE")
}

/**
 * Gets the static string value of an attribute (returns null if it contains ERB)
 */
export function getStaticAttributeValue(attributeNode: HTMLAttributeNode): string | null {
  if (!hasStaticAttributeValue(attributeNode)) return null

  const valueNode = attributeNode.value as HTMLAttributeValueNode

  const result = valueNode.children
    ?.filter(child => child.type === "AST_LITERAL_NODE")
    .map(child => (child as LiteralNode).content)
    .join("") || ""

  return result
}

/**
 * Gets the value nodes array for dynamic inspection
 */
export function getAttributeValueNodes(attributeNode: HTMLAttributeNode): Node[] {
  const valueNode = attributeNode.value as HTMLAttributeValueNode | null

  return valueNode?.children || []
}

/**
 * Checks if an attribute value contains any static content (for validation purposes)
 */
export function hasStaticAttributeValueContent(attributeNode: HTMLAttributeNode): boolean {
  const valueNodes = getAttributeValueNodes(attributeNode)

  return hasStaticContent(valueNodes)
}

/**
 * Gets the static content of an attribute value (all literal parts combined)
 * Returns the concatenated literal content, or null if no literal nodes exist
 */
export function getStaticAttributeValueContent(attributeNode: HTMLAttributeNode): string | null {
  const valueNodes = getAttributeValueNodes(attributeNode)

  return getStaticContentFromNodes(valueNodes)
}

/**
 * Gets the attribute value content from an HTMLAttributeValueNode
 */
export function getAttributeValue(attributeNode: HTMLAttributeNode): string | null {
  const valueNode: HTMLAttributeValueNode | null = attributeNode.value as HTMLAttributeValueNode

  if (valueNode === null) return null

  if (valueNode.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE" || !valueNode.children?.length) {
    return null
  }

  let result = ""

  for (const child of valueNode.children) {
    switch (child.type) {
      case "AST_ERB_CONTENT_NODE": {
        const erbNode = child as ERBNode

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
 * Gets the quote type used for an attribute value
 */
export function getAttributeValueQuoteType(nodeOrAttribute: HTMLAttributeNode | HTMLAttributeValueNode): "single" | "double" | "none" | null {
  let valueNode: HTMLAttributeValueNode | undefined

  if (nodeOrAttribute.type === "AST_HTML_ATTRIBUTE_NODE") {
    const attributeNode = nodeOrAttribute as HTMLAttributeNode

    if (attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
      valueNode = attributeNode.value as HTMLAttributeValueNode
    }
  } else if (nodeOrAttribute.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
    valueNode = nodeOrAttribute as HTMLAttributeValueNode
  }

  if (valueNode) {
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
export function getAttribute(node: HTMLOpenTagNode, attributeName: string): HTMLAttributeNode | null {
  const attributes = getAttributes(node)

  return findAttributeByName(attributes, attributeName)
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

export const HTML_VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
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
 * SVG elements that use camelCase naming
 */
export const SVG_CAMEL_CASE_ELEMENTS = new Set([
  "animateMotion",
  "animateTransform",
  "clipPath",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "foreignObject",
  "glyphRef",
  "linearGradient",
  "radialGradient",
  "textPath"
])

/**
 * Mapping from lowercase SVG element names to their correct camelCase versions
 * Generated dynamically from SVG_CAMEL_CASE_ELEMENTS
 */
export const SVG_LOWERCASE_TO_CAMELCASE = new Map(
  Array.from(SVG_CAMEL_CASE_ELEMENTS).map(element => [element.toLowerCase(), element])
)

export const VALID_ARIA_ROLES = new Set([
  "banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search",
  "article", "cell", "columnheader", "definition", "directory", "document", "feed", "figure",
  "group", "heading", "img", "list", "listitem", "math", "none", "note", "presentation",
  "row", "rowgroup", "rowheader", "separator", "table", "term", "tooltip",
  "alert", "alertdialog", "button", "checkbox", "combobox", "dialog", "grid", "gridcell", "link",
  "listbox", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "option",
  "progressbar", "radio", "radiogroup", "scrollbar", "searchbox", "slider", "spinbutton",
  "status", "switch", "tab", "tablist", "tabpanel", "textbox", "timer", "toolbar", "tree",
  "treegrid", "treeitem",
  "log", "marquee"
]);

/**
 * Parameter types for AttributeVisitorMixin methods
 */
export interface StaticAttributeStaticValueParams {
  attributeName: string
  attributeValue: string
  attributeNode: HTMLAttributeNode
  parentNode: HTMLOpenTagNode
}

export interface StaticAttributeDynamicValueParams {
  attributeName: string
  valueNodes: Node[]
  attributeNode: HTMLAttributeNode
  parentNode: HTMLOpenTagNode
  combinedValue?: string | null
}

export interface DynamicAttributeStaticValueParams {
  nameNodes: Node[]
  attributeValue: string
  attributeNode: HTMLAttributeNode
  parentNode: HTMLOpenTagNode
  combinedName?: string
}

export interface DynamicAttributeDynamicValueParams {
  nameNodes: Node[]
  valueNodes: Node[]
  attributeNode: HTMLAttributeNode
  parentNode: HTMLOpenTagNode
  combinedName?: string
  combinedValue?: string | null
}

export const ARIA_ATTRIBUTES =  new Set([
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-colcount',
  'aria-colindex',
  'aria-colspan',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-modal',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-placeholder',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-roledescription',
  'aria-rowcount',
  'aria-rowindex',
  'aria-rowspan',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
])

/**
 * Helper function to create a location at the end of the source with a 1-character range
 */
export function createEndOfFileLocation(source: string): Location {
  const lines = source.split('\n')
  const lastLineNumber = lines.length
  const lastLine = lines[lines.length - 1]
  const lastColumnNumber = lastLine.length

  const startColumn = lastColumnNumber > 0 ? lastColumnNumber - 1 : 0
  const start = new Position(lastLineNumber, startColumn)
  const end = new Position(lastLineNumber, lastColumnNumber)

  return new Location(start, end)
}

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
 * Checks if an element is a void element
 */
export function isVoidElement(tagName: string): boolean {
  return HTML_VOID_ELEMENTS.has(tagName.toLowerCase())
}

/**
 * Checks if an attribute is a boolean attribute
 */
export function isBooleanAttribute(attributeName: string): boolean {
  return HTML_BOOLEAN_ATTRIBUTES.has(attributeName.toLowerCase())
}

/**
 * Attribute visitor that provides granular processing based on both
 * attribute name type (static/dynamic) and value type (static/dynamic)
 *
 * This gives you 4 distinct methods to override:
 * - checkStaticAttributeStaticValue()   - name="class" value="foo"
 * - checkStaticAttributeDynamicValue()  - name="class" value="<%= css_class %>"
 * - checkDynamicAttributeStaticValue()  - name="data-<%= key %>" value="foo"
 * - checkDynamicAttributeDynamicValue() - name="data-<%= key %>" value="<%= value %>"
 */
export abstract class AttributeVisitorMixin extends BaseRuleVisitor {
  constructor(ruleName: string, context?: Partial<LintContext>) {
    super(ruleName, context)
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAttributesOnNode(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkAttributesOnNode(node: HTMLOpenTagNode): void {
    forEachAttribute(node, (attributeNode) => {
      const staticAttributeName = getAttributeName(attributeNode)
      const isDynamicName = hasDynamicAttributeName(attributeNode)
      const staticAttributeValue = getStaticAttributeValue(attributeNode)
      const valueNodes = getAttributeValueNodes(attributeNode)
      const hasOutputERB = hasERBOutput(valueNodes)
      const isEffectivelyStaticValue = isEffectivelyStatic(valueNodes)

      if (staticAttributeName && staticAttributeValue !== null) {
        this.checkStaticAttributeStaticValue({
          attributeName: staticAttributeName,
          attributeValue: staticAttributeValue,
          attributeNode,
          parentNode: node
        })
      } else if (staticAttributeName && isEffectivelyStaticValue && !hasOutputERB) {
        const validatableContent = getValidatableStaticContent(valueNodes) || ""

        this.checkStaticAttributeStaticValue({ attributeName: staticAttributeName, attributeValue: validatableContent, attributeNode, parentNode: node })
      } else if (staticAttributeName && hasOutputERB) {
        const combinedValue = getAttributeValue(attributeNode)

        this.checkStaticAttributeDynamicValue({ attributeName: staticAttributeName, valueNodes, attributeNode, parentNode: node, combinedValue })
      } else if (isDynamicName && staticAttributeValue !== null) {
        const nameNode = attributeNode.name as HTMLAttributeNameNode
        const nameNodes = nameNode.children || []
        const combinedName = getCombinedAttributeNameString(attributeNode)

        this.checkDynamicAttributeStaticValue({ nameNodes, attributeValue: staticAttributeValue, attributeNode, parentNode: node, combinedName })
      } else if (isDynamicName) {
        const nameNode = attributeNode.name as HTMLAttributeNameNode
        const nameNodes = nameNode.children || []
        const combinedName = getCombinedAttributeNameString(attributeNode)
        const combinedValue = getAttributeValue(attributeNode)

        this.checkDynamicAttributeDynamicValue({ nameNodes, valueNodes, attributeNode, parentNode: node, combinedName, combinedValue })
      }
    })
  }

  /**
   * Static attribute name with static value: class="container"
   */
  protected checkStaticAttributeStaticValue(params: StaticAttributeStaticValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Static attribute name with dynamic value: class="<%= css_class %>"
   */
  protected checkStaticAttributeDynamicValue(params: StaticAttributeDynamicValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Dynamic attribute name with static value: data-<%= key %>="foo"
   */
  protected checkDynamicAttributeStaticValue(params: DynamicAttributeStaticValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Dynamic attribute name with dynamic value: data-<%= key %>="<%= value %>"
   */
  protected checkDynamicAttributeDynamicValue(params: DynamicAttributeDynamicValueParams): void {
    // Default implementation does nothing
  }
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
  node: HTMLOpenTagNode,
  callback: (attributeNode: HTMLAttributeNode) => void
): void {
  const attributes = getAttributes(node)

  for (const child of attributes) {
    if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
      callback(child as HTMLAttributeNode)
    }
  }
}

/**
 * Base lexer visitor class that provides common functionality for lexer-based rule visitors
 */
export abstract class BaseLexerRuleVisitor {
  public readonly offenses: LintOffense[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create a lint offense for lexer rules
   */
  protected createOffense(message: string, location: Location, severity: LintSeverity = "error"): LintOffense {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      severity,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, severity: LintSeverity = "error"): void {
    this.offenses.push(this.createOffense(message, location, severity))
  }

  /**
   * Main entry point for lexer rule visitors
   * @param lexResult - The lexer result containing tokens and source
   */
  visit(lexResult: LexResult): void {
    this.visitTokens(lexResult.value.tokens)
  }

  /**
   * Visit all tokens
   * Override this method to implement token-level checks
   */
  protected visitTokens(tokens: Token[]): void {
    for (const token of tokens) {
      this.visitToken(token)
    }
  }

  /**
   * Visit individual tokens
   * Override this method to implement per-token checks
   */
  protected visitToken(_token: Token): void {
    // Default implementation does nothing
  }

}

/**
 * Base source visitor class that provides common functionality for source-based rule visitors
 */
export abstract class BaseSourceRuleVisitor {
  public readonly offenses: LintOffense[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create a lint offense for source rules
   */
  protected createOffense(message: string, location: Location, severity: LintSeverity = "error"): LintOffense {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      severity,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, severity: LintSeverity = "error"): void {
    this.offenses.push(this.createOffense(message, location, severity))
  }

  /**
   * Main entry point for source rule visitors
   * @param source - The raw source code
   */
  visit(source: string): void {
    this.visitSource(source)
  }

  /**
   * Visit the source code directly
   * Override this method to implement source-level checks
   */
  protected abstract visitSource(source: string): void

  /**
   * Helper method to create a location for a specific position in the source
   */
  protected createLocationAt(source: string, position: number): Location {
    const beforePosition = source.substring(0, position)
    const lines = beforePosition.split('\n')
    const line = lines.length
    const column = lines[lines.length - 1].length + 1

    const start = new Position(line, column)
    const end = new Position(line, column)

    return new Location(start, end)
  }
}
