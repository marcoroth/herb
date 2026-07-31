import {
  Visitor,
  Location,
  hasERBOutput,
  isEffectivelyStatic,
  getValidatableStaticContent,
  getAttributeName,
  getStaticAttributeValue,
  hasDynamicAttributeName,
  getCombinedAttributeNameString,
  getAttributeValueNodes,
  getAttributeValue,
  getTagLocalName,
  forEachAttribute,
  stringIndexFromByteOffset,
} from "@herb-tools/core"

import type {
  HTMLAttributeNameNode,
  HTMLAttributeNode,
  HTMLElementNode,
  HTMLOpenTagNode,
  LexResult,
  Token,
  Node
} from "@herb-tools/core"

import {
  HTML_INLINE_ELEMENTS,
  HTML_BLOCK_ELEMENTS,
  HTML_VOID_ELEMENTS,
  HTML_KNOWN_ELEMENTS,
  DOCUMENT_ONLY_TAG_NAMES,
  HTML_ONLY_TAG_NAMES,
  HEAD_ONLY_TAG_NAMES,
  HEAD_AND_BODY_TAG_NAMES,
  MATHML_KNOWN_ELEMENTS,
  SVG_KNOWN_ELEMENTS,
} from "./html-data.js"

import { DEFAULT_LINT_CONTEXT } from "../types.js"

import type * as Nodes from "@herb-tools/core"
import type { DiagnosticTag } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, LintSeverity, BaseAutofixContext } from "../types.js"

export enum ControlFlowType {
  CONDITIONAL,
  LOOP
}

/**
 * Base visitor class that provides common functionality for rule visitors
 */
export abstract class BaseRuleVisitor<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends Visitor {
  public readonly offenses: UnboundLintOffense<TAutofixContext>[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    super()

    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create an unbound lint offense (without severity).
   * The Linter will bind severity based on the rule's config.
   */
  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): void {
    this.offenses.push(this.createOffense(message, location, autofixContext, severity, tags))
  }
}

/**
 * Mixin that adds control flow tracking capabilities to rule visitors
 * This allows rules to track state across different control flow structures
 * like if/else branches, loops, etc.
 *
 * @template TAutofixContext - Type for autofix context (node + custom data)
 * @template TControlFlowState - Type for state passed between onEnterControlFlow and onExitControlFlow
 * @template TBranchState - Type for state passed between onEnterBranch and onExitBranch
 */
export abstract class ControlFlowTrackingVisitor<TAutofixContext extends BaseAutofixContext = BaseAutofixContext, TControlFlowState = any, TBranchState = any> extends BaseRuleVisitor<TAutofixContext> {
  protected isInControlFlow: boolean = false
  protected currentControlFlowType: ControlFlowType | null = null

  /**
   * Handle visiting a control flow node with proper scope management
   */
  protected handleControlFlowNode(_node: Node, controlFlowType: ControlFlowType, visitChildren: () => void): void {
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
 * Mixin that tracks the current HTML element stack during AST traversal.
 * Provides convenient access to the current element, tag name, parent element,
 * and ancestry checks.
 *
 * Useful for rules that need element context when visiting child nodes
 * (e.g., checking attributes in the context of their parent element).
 *
 * @template TAutofixContext - Type for autofix context (node + custom data)
 */
export abstract class ElementStackVisitor<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends BaseRuleVisitor<TAutofixContext> {
  private elementStack: HTMLElementNode[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    this.elementStack.push(node)
    super.visitHTMLElementNode(node)
    this.elementStack.pop()
  }

  /**
   * The current HTML element being visited, or null if not inside an element.
   */
  protected get currentElement(): HTMLElementNode | null {
    return this.elementStack.at(-1) ?? null
  }

  /**
   * The tag name of the current HTML element, or null if not inside an element.
   */
  protected get currentTagName(): string | null {
    const element = this.currentElement
    return element ? getTagLocalName(element) : null
  }

  /**
   * The parent HTML element (one level up), or null if at the top level.
   */
  protected get parentElement(): HTMLElementNode | null {
    return this.elementStack.at(-2) ?? null
  }

  /**
   * The tag name of the parent HTML element, or null if at the top level.
   */
  protected get parentTagName(): string | null {
    const element = this.parentElement
    return element ? getTagLocalName(element) : null
  }

  /**
   * Checks if the current traversal position is inside an element with any of the given tag names.
   */
  protected isInsideElement(...tagNames: string[]): boolean {
    return this.elementStack.some(element => {
      const name = getTagLocalName(element)
      return name !== null && tagNames.includes(name)
    })
  }

  /**
   * All ancestor HTML elements, from outermost to innermost.
   */
  protected get ancestors(): readonly HTMLElementNode[] {
    return this.elementStack
  }

  /**
   * The current nesting depth (number of ancestor HTML elements).
   */
  protected get elementDepth(): number {
    return this.elementStack.length
  }
}

export * from "./html-data.js"
export * from "./aria-data.js"

export { HTML_BOOLEAN_ATTRIBUTES, isBooleanAttribute } from "@herb-tools/core"

export function isKnownHTMLElement(tagName: string): boolean {
  return HTML_KNOWN_ELEMENTS.has(tagName.toLowerCase())
}

export function isCustomElement(tagName: string): boolean {
  return tagName.includes("-")
}

export function isKnownSVGElement(tagName: string): boolean {
  return SVG_KNOWN_ELEMENTS.has(tagName.toLowerCase())
}

export function isKnownMathMLElement(tagName: string): boolean {
  return MATHML_KNOWN_ELEMENTS.has(tagName.toLowerCase())
}

/**
 * Parameter types for AttributeVisitorMixin methods
 */
export interface StaticAttributeStaticValueParams {
  attributeName: string
  attributeValue: string
  attributeNode: HTMLAttributeNode
  originalAttributeName: string
  parentNode: HTMLOpenTagNode
}

export interface StaticAttributeDynamicValueParams {
  attributeName: string
  valueNodes: Node[]
  attributeNode: HTMLAttributeNode
  originalAttributeName: string
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

/**
 * Helper function to create a location at the end of the source with a 1-character range
 */
export function createEndOfFileLocation(source: string): Location {
  const lines = source.split('\n')
  const lastLineNumber = lines.length
  const lastLine = lines[lines.length - 1]
  const lastColumnNumber = lastLine.length

  const startColumn = lastColumnNumber > 0 ? lastColumnNumber - 1 : 0

  return Location.from(lastLineNumber, startColumn, lastLineNumber, lastColumnNumber)
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
 * Attribute visitor that provides granular processing based on both
 * attribute name type (static/dynamic) and value type (static/dynamic)
 *
 * This gives you 4 distinct methods to override:
 * - checkStaticAttributeStaticValue()   - name="class" value="foo"
 * - checkStaticAttributeDynamicValue()  - name="class" value="<%= css_class %>"
 * - checkDynamicAttributeStaticValue()  - name="data-<%= key %>" value="foo"
 * - checkDynamicAttributeDynamicValue() - name="data-<%= key %>" value="<%= value %>"
 */
export abstract class AttributeVisitorMixin<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> extends BaseRuleVisitor<TAutofixContext> {
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
      const originalAttributeName = getAttributeName(attributeNode, false) || ""
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
          originalAttributeName,
          parentNode: node
        })
      } else if (staticAttributeName && isEffectivelyStaticValue && !hasOutputERB) {
        const validatableContent = getValidatableStaticContent(valueNodes) || ""

        this.checkStaticAttributeStaticValue({ attributeName: staticAttributeName, attributeValue: validatableContent, attributeNode, originalAttributeName, parentNode: node })
      } else if (staticAttributeName && hasOutputERB) {
        const combinedValue = getAttributeValue(attributeNode)

        this.checkStaticAttributeDynamicValue({ attributeName: staticAttributeName, valueNodes, attributeNode, parentNode: node, originalAttributeName, combinedValue })
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
  protected checkStaticAttributeStaticValue(_params: StaticAttributeStaticValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Static attribute name with dynamic value: class="<%= css_class %>"
   */
  protected checkStaticAttributeDynamicValue(_params: StaticAttributeDynamicValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Dynamic attribute name with static value: data-<%= key %>="foo"
   */
  protected checkDynamicAttributeStaticValue(_params: DynamicAttributeStaticValueParams): void {
    // Default implementation does nothing
  }

  /**
   * Dynamic attribute name with dynamic value: data-<%= key %>="<%= value %>"
   */
  protected checkDynamicAttributeDynamicValue(_params: DynamicAttributeDynamicValueParams): void {
    // Default implementation does nothing
  }
}

/**
 * Base lexer visitor class that provides common functionality for lexer-based rule visitors
 */
export abstract class BaseLexerRuleVisitor<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  public readonly offenses: UnboundLintOffense<TAutofixContext>[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create an unbound lint offense (without severity).
   * The Linter will bind severity based on the rule's config.
   */
  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): void {
    this.offenses.push(this.createOffense(message, location, autofixContext, severity, tags))
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
export abstract class BaseSourceRuleVisitor<TAutofixContext extends BaseAutofixContext = BaseAutofixContext> {
  public readonly offenses: UnboundLintOffense<TAutofixContext>[] = []
  protected ruleName: string
  protected context: LintContext

  constructor(ruleName: string, context?: Partial<LintContext>) {
    this.ruleName = ruleName
    this.context = { ...DEFAULT_LINT_CONTEXT, ...context }
  }

  /**
   * Helper method to create an unbound lint offense (without severity).
   * The Linter will bind severity based on the rule's config.
   */
  protected createOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): UnboundLintOffense<TAutofixContext> {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location,
      autofixContext,
      severity,
      tags,
    }
  }

  /**
   * Helper method to add an offense to the offenses array
   */
  protected addOffense(message: string, location: Location, autofixContext?: TAutofixContext, severity?: LintSeverity, tags?: DiagnosticTag[]): void {
    this.offenses.push(this.createOffense(message, location, autofixContext, severity, tags))
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
}

/**
 * Autofix utilities for applying string replacements
 */

/**
 * Checks if two locations are equal
 * @param a - First location
 * @param b - Second location
 * @returns true if locations are equal
 */
export function locationsEqual(a: Location, b: Location): boolean {
  return a.start.line === b.start.line &&
         a.start.column === b.start.column &&
         a.end.line === b.end.line &&
         a.end.column === b.end.column
}

/**
 * Finds a node in the AST that has a specific location
 * Uses direct recursive traversal for reliability
 * @param root - The root node to search from
 * @param location - The location to match
 * @param predicate - Optional predicate function to filter nodes (e.g., isERBNode)
 * @returns The matching node or null if not found
 */
export function findNodeByLocation(root: Node, location: Location, predicate?: (node: Node) => boolean): any {
  const visited = new Set<any>()

  function search(node: any): any {
    if (!node || visited.has(node)) return null
    visited.add(node)

    if (node.location && locationsEqual(node.location, location)) {
      if (!predicate || predicate(node)) {
        return node
      }
    }

    const propsToCheck = ['tag_opening', 'tag_closing', 'tag_name', 'name', 'equals', 'value', 'content']
    for (const prop of propsToCheck) {
      if (node[prop]?.location && locationsEqual(node[prop].location, location)) {
        if (!predicate || predicate(node)) {
          return node
        }
      }
    }

    if (typeof node.compactChildNodes === 'function') {
      for (const child of node.compactChildNodes()) {
        const found = search(child)
        if (found) return found
      }
    } else {
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          const found = search(child)
          if (found) return found
        }
      }

      if (node.body && Array.isArray(node.body)) {
        for (const child of node.body) {
          const found = search(child)
          if (found) return found
        }
      }
    }

    return null
  }

  return search(root)
}

/**
 * AST Navigation Utilities
 * These utilities help navigate the AST tree for complex autofix operations
 */

/**
 * Finds the parent node of a given child node in the AST
 * @param root - The root node to search from (typically the document node)
 * @param target - The child node to find the parent of
 * @returns The parent node, or null if not found
 *
 * @example
 * const parent = findParent(result.value, offense.autofixContext.node)
 * if (parent?.type === "AST_HTML_ELEMENT_NODE") {
 *   // Modify parent...
 * }
 */
export function findParent(root: Node, target: Node): Node | null {
  let parentNode: Node | null = null

  const search = (node: Node, _parent: Node | null = null): void => {
    if (parentNode) return

    const nodeAny = node as any

    if (nodeAny.children) {
      for (const child of nodeAny.children) {
        if (child === target) {
          parentNode = node
          return
        }
      }
    }

    const propsToCheck = ['open_tag', 'close_tag', 'body', 'name', 'value']

    for (const prop of propsToCheck) {
      const value = (node as any)[prop]
      if (value === target) {
        parentNode = node
        return
      }
      if (Array.isArray(value) && value.includes(target)) {
        parentNode = node
        return
      }
    }

    if (nodeAny.children) {
      for (const child of nodeAny.children) {
        search(child, node)
        if (parentNode) return
      }
    }

    for (const prop of propsToCheck) {
      const value = (node as any)[prop]
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            search(item, node)
            if (parentNode) return
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        search(value, node)
        if (parentNode) return
      }
    }
  }

  search(root)

  return parentNode
}

export function isDocumentOnlyTag(tagName: string): boolean {
  return DOCUMENT_ONLY_TAG_NAMES.has(tagName.toLowerCase())
}

export function isHtmlOnlyTag(tagName: string): boolean {
  return HTML_ONLY_TAG_NAMES.has(tagName.toLowerCase())
}

export function isHeadOnlyTag(tagName: string): boolean {
  return HEAD_ONLY_TAG_NAMES.has(tagName.toLowerCase())
}

export function isHeadAndBodyTag(tagName: string): boolean {
  return HEAD_AND_BODY_TAG_NAMES.has(tagName.toLowerCase())
}

export function isBodyOnlyTag(tagName: string): boolean {
  const tag = tagName.toLowerCase()

  return (
    !isDocumentOnlyTag(tag) &&
    !isHtmlOnlyTag(tag) &&
    !isHeadOnlyTag(tag) &&
    !isHeadAndBodyTag(tag)
  )
}

export function isBodyTag(tagName: string): boolean {
  const tag = tagName.toLowerCase()
  return (
    !isDocumentOnlyTag(tag) &&
    !isHtmlOnlyTag(tag) &&
    (isBodyOnlyTag(tag) || isHeadAndBodyTag(tag))
  )
}

export function isHeadTag(tagName: string): boolean {
  const tag = tagName.toLowerCase()

  return (
    !isDocumentOnlyTag(tag) &&
    !isHtmlOnlyTag(tag) &&
    (isHeadOnlyTag(tag) || isHeadAndBodyTag(tag))
  )
}

/**
 * Creates a Location from a known start line/column and a character offset within content.
 * Unlike `locationFromByteOffset`, this does not require the full source string, it computes
 * the position relative to a node's start position.
 */
export function locationFromContentOffset(startLine: number, startColumn: number, content: string, offset: number): Location {
  let line = startLine
  let column = startColumn

  for (let index = 0; index < offset; index++) {
    if (content[index] === "\n") {
      line++
      column = 0
    } else {
      column++
    }
  }

  return Location.from(line, column, line, column + 1)
}

/**
 * Checks if a position (line, column) is within a node's location range.
 * @param node - The node to check
 * @param line - Line number (1-based)
 * @param column - Column number (0-based)
 * @returns true if the position is within the node's location
 */
function isPositionInNode(node: Node, line: number, column: number): boolean {
  if (!node.location) return false

  const { start, end } = node.location

  if (line < start.line) return false
  if (line === start.line && column < start.column) return false

  if (line > end.line) return false
  if (line === end.line && column >= end.column) return false

  return true
}

/**
 * Finds a node in the AST that contains a specific position.
 * Returns the deepest (most specific) node that matches the position and optional predicate.
 *
 * @param root - The root node to search from
 * @param line - Line number (1-based)
 * @param column - Column number (0-based)
 * @param predicate - Optional predicate function to filter nodes
 * @returns The matching node or null if not found
 */
export function findNodeAtPosition(root: Node, line: number, column: number, predicate?: (node: Node) => boolean): Node | null {
  let bestMatch: Node | null = null
  const visited = new Set<Node>()

  function search(node: Node): void {
    if (!node || visited.has(node)) return
    visited.add(node)

    if (isPositionInNode(node, line, column)) {
      if (!predicate || predicate(node)) {
        if (!bestMatch || isMoreSpecific(node, bestMatch)) {
          bestMatch = node
        }
      }
    }

    const nodeAny = node as any

    if (typeof nodeAny.compactChildNodes === 'function') {
      for (const child of nodeAny.compactChildNodes()) {
        search(child)
      }
    } else {
      if (nodeAny.children && Array.isArray(nodeAny.children)) {
        for (const child of nodeAny.children) {
          if (child) search(child)
        }
      }

      if (nodeAny.body && Array.isArray(nodeAny.body)) {
        for (const child of nodeAny.body) {
          if (child) search(child)
        }
      }
    }
  }

  function isMoreSpecific(nodeA: Node, nodeB: Node): boolean {
    if (!nodeA.location || !nodeB.location) return false

    const aStart = nodeA.location.start
    const aEnd = nodeA.location.end
    const bStart = nodeB.location.start
    const bEnd = nodeB.location.end

    const startsAtOrAfter = aStart.line > bStart.line || (aStart.line === bStart.line && aStart.column >= bStart.column)
    const endsAtOrBefore = aEnd.line < bEnd.line || (aEnd.line === bEnd.line && aEnd.column <= bEnd.column)

    return startsAtOrAfter && endsAtOrBefore
  }

  search(root)

  return bestMatch
}
