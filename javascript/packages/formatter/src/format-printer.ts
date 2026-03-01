import dedent from "dedent"

import { Printer, IdentityPrinter } from "@herb-tools/printer"

import {
  getTagName,
  getCombinedAttributeName,
  getCombinedStringFromNodes,
  isNode,
  isToken,
  isParseResult,
  isNoneOf,
  isERBNode,
  isCommentNode,
  isERBControlFlowNode,
  isERBCommentNode,
  isERBOutputNode,
  isHTMLOpenTagNode,
  filterNodes,
} from "@herb-tools/core"

import {
  areAllNestedElementsInline,
  buildLineWithWord,
  countAdjacentInlineElements,
  endsWithWhitespace,
  filterEmptyNodesForHerbDisable,
  filterSignificantChildren,
  findPreviousMeaningfulSibling,
  hasComplexERBControlFlow,
  hasMixedTextAndInlineContent,
  hasMultilineTextContent,
  hasWhitespaceBetween,
  isBlockLevelNode,
  isClosingPunctuation,
  isContentPreserving,
  isFrontmatter,
  isHerbDisableComment,
  isInlineElement,
  isLineBreakingElement,
  isNonWhitespaceNode,
  isPureWhitespaceNode,
  needsSpaceBetween,
  normalizeAndSplitWords,
  shouldAppendToLastLine,
  shouldPreserveUserSpacing,
} from "./format-helpers.js"

import {
  FORMATTABLE_ATTRIBUTES,
  INLINE_ELEMENTS,
  SPACEABLE_CONTAINERS,
  TOKEN_LIST_ATTRIBUTES,
} from "./format-helpers.js"

import type {
  ContentUnitWithNode,
  ElementFormattingAnalysis,
} from "./format-helpers.js"

import {
  ParseResult,
  Node,
  DocumentNode,
  HTMLOpenTagNode,
  HTMLConditionalOpenTagNode,
  HTMLCloseTagNode,
  HTMLElementNode,
  HTMLConditionalElementNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLAttributeNameNode,
  HTMLTextNode,
  HTMLCommentNode,
  HTMLDoctypeNode,
  LiteralNode,
  WhitespaceNode,
  ERBContentNode,
  ERBBlockNode,
  ERBEndNode,
  ERBElseNode,
  ERBIfNode,
  ERBWhenNode,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBForNode,
  ERBRescueNode,
  ERBEnsureNode,
  ERBBeginNode,
  ERBUnlessNode,
  ERBYieldNode,
  ERBInNode,
  XMLDeclarationNode,
  CDATANode,
  Token
} from "@herb-tools/core"

import type { ERBNode } from "@herb-tools/core"
import type { FormatOptions } from "./options.js"

/**
 * ASCII whitespace pattern - use instead of \s to preserve Unicode whitespace
 * characters like NBSP (U+00A0) and full-width space (U+3000)
 */
const ASCII_WHITESPACE = /[ \t\n\r]+/g

/**
 * Gets the children of an open tag, narrowing from the union type.
 * Returns empty array for conditional open tags.
 */
function getOpenTagChildren(element: HTMLElementNode): Node[] {
  return isHTMLOpenTagNode(element.open_tag) ? element.open_tag.children : []
}

/**
 * Gets the tag_closing token of an open tag, narrowing from the union type.
 * Returns null for conditional open tags.
 */
function getOpenTagClosing(element: HTMLElementNode): Token | null {
  return isHTMLOpenTagNode(element.open_tag) ? element.open_tag.tag_closing : null
}

/**
 * Printer traverses the Herb AST using the Visitor pattern
 * and emits a formatted string with proper indentation, line breaks, and attribute wrapping.
 */
export class FormatPrinter extends Printer {
  /**
   * @deprecated integrate indentWidth into this.options and update FormatOptions to extend from @herb-tools/printer options
   */
  private indentWidth: number

  /**
   * @deprecated integrate maxLineLength into this.options and update FormatOptions to extend from @herb-tools/printer options
   */
  private maxLineLength: number

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  private lines: string[] = []
  private indentLevel: number = 0
  private inlineMode: boolean = false
  private inConditionalOpenTagContext: boolean = false
  private currentAttributeName: string | null = null
  private elementStack: HTMLElementNode[] = []
  private elementFormattingAnalysis = new Map<HTMLElementNode, ElementFormattingAnalysis>()
  private nodeIsMultiline = new Map<Node, boolean>()
  private stringLineCount: number = 0
  private tagGroupsCache = new Map<Node[], Map<number, { tagName: string; groupStart: number; groupEnd: number }>>()
  private allSingleLineCache = new Map<Node[], boolean>()


  public source: string

  constructor(source: string, options: Required<FormatOptions>) {
    super()

    this.source = source
    this.indentWidth = options.indentWidth
    this.maxLineLength = options.maxLineLength
  }

  print(input: Node | ParseResult | Token): string {
    if (isToken(input)) return input.value

    const node: Node = isParseResult(input) ? input.value : input

    // TODO: refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
    this.lines = []
    this.indentLevel = 0
    this.stringLineCount = 0
    this.nodeIsMultiline.clear()
    this.tagGroupsCache.clear()
    this.allSingleLineCache.clear()

    this.visit(node)

    return this.lines.join("\n")
  }

  /**
   * Get the current element (top of stack)
   */
  private get currentElement(): HTMLElementNode | null {
    return this.elementStack.length > 0 ? this.elementStack[this.elementStack.length - 1] : null
  }

  /**
   * Get the current tag name from the current element context
   */
  private get currentTagName(): string {
    return this.currentElement?.tag_name?.value ?? ""
  }

  /**
   * Append text to the last line instead of creating a new line
   */
  private pushToLastLine(text: string): void {
    if (this.lines.length > 0) {
      this.lines[this.lines.length - 1] += text
    } else {
      this.lines.push(text)
    }
  }

  /**
   * Capture output from a callback into a separate lines array
   * Useful for testing what output would be generated without affecting the main output
   */
  private capture(callback: () => void): string[] {
    const previousLines = this.lines
    const previousInlineMode = this.inlineMode
    const previousStringLineCount = this.stringLineCount

    this.lines = []
    this.stringLineCount = 0

    try {
      callback()
      return this.lines
    } finally {
      this.lines = previousLines
      this.inlineMode = previousInlineMode
      this.stringLineCount = previousStringLineCount
    }
  }

  /**
   * Track a boundary node's multiline status by comparing line count before/after rendering.
   */
  private trackBoundary(node: Node, callback: () => void): void {
    const startLineCount = this.stringLineCount
    callback()
    const endLineCount = this.stringLineCount

    this.nodeIsMultiline.set(node, (endLineCount - startLineCount) > 1)
  }

  /**
   * Capture all nodes that would be visited during a callback
   * Returns a flat list of all nodes without generating any output
   */
  private captureNodes(callback: () => void): Node[] {
    const capturedNodes: Node[] = []
    const previousLines = this.lines
    const previousInlineMode = this.inlineMode

    const originalPush = this.push.bind(this)
    const originalPushToLastLine = this.pushToLastLine.bind(this)
    const originalVisit = this.visit.bind(this)

    this.lines = []
    this.push = () => {}
    this.pushToLastLine = () => {}

    this.visit = (node: Node) => {
      capturedNodes.push(node)
      originalVisit(node)
    }

    try {
      callback()

      return capturedNodes
    } finally {
      this.lines = previousLines
      this.inlineMode = previousInlineMode
      this.push = originalPush
      this.pushToLastLine = originalPushToLastLine
      this.visit = originalVisit
    }
  }

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  private push(line: string) {
    this.lines.push(line)
    this.stringLineCount++
  }

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  private pushWithIndent(line: string) {
    const indent = line.trim() === "" ? "" : this.indent

    this.push(indent + line)
  }

  private withIndent<T>(callback: () => T): T {
    this.indentLevel++
    const result = callback()
    this.indentLevel--

    return result
  }

  private get indent(): string {
    return " ".repeat(this.indentLevel * this.indentWidth)
  }

  /**
   * Format ERB content with proper spacing around the inner content.
   * Returns empty string if content is empty, otherwise adds a leading space
   * and a trailing space (or newline for heredoc content starting with "<<").
   */
  private formatERBContent(content: string): string {
    const trimmedContent = content.trim();

    // See: https://github.com/marcoroth/herb/issues/476
    // TODO: revisit once we have access to Prism nodes
    const suffix = trimmedContent.startsWith("<<") ? "\n" : " "

    return trimmedContent ? ` ${trimmedContent}${suffix}` : ""
  }

  /**
   * Count total attributes including those inside ERB conditionals
   */
  private getTotalAttributeCount(attributes: HTMLAttributeNode[], inlineNodes: Node[] = []): number {
    let totalAttributeCount = attributes.length

    inlineNodes.forEach(node => {
      if (isERBControlFlowNode(node)) {
        const capturedNodes = this.captureNodes(() => this.visit(node))
        const attributeNodes = filterNodes(capturedNodes, HTMLAttributeNode)

        totalAttributeCount += attributeNodes.length
      }
    })

    return totalAttributeCount
  }

  /**
   * Extract inline nodes (non-attribute, non-whitespace) from a list of nodes
   */
  private extractInlineNodes(nodes: Node[]): Node[] {
    return nodes.filter(child => isNoneOf(child, HTMLAttributeNode, WhitespaceNode))
  }

  /**
   * Check if a node will render as multiple lines when formatted.
   */
  private isMultilineElement(node: Node): boolean {
    if (isNode(node, ERBContentNode)) {
      return (node.content?.value || "").includes("\n")
    }

    if (isNode(node, HTMLElementNode) && isContentPreserving(node)) {
      return true
    }

    const tracked = this.nodeIsMultiline.get(node)

    if (tracked !== undefined) {
      return tracked
    }

    return false
  }

  /**
   * Get a grouping key for a node (tag name for HTML, ERB type for ERB)
   */
  private getGroupingKey(node: Node): string | null {
    if (isNode(node, HTMLElementNode)) {
      return getTagName(node)
    }

    if (isERBOutputNode(node)) return "erb-output"
    if (isERBCommentNode(node)) return "erb-comment"
    if (isERBNode(node)) return "erb-code"

    return null
  }

  /**
   * Detect groups of consecutive same-tag/same-type single-line elements
   * Returns a map of index -> group info for efficient lookup
   */
  private detectTagGroups(siblings: Node[]): Map<number, { tagName: string; groupStart: number; groupEnd: number }> {
    const cached = this.tagGroupsCache.get(siblings)
    if (cached) return cached

    const groupMap = new Map<number, { tagName: string; groupStart: number; groupEnd: number }>()
    const meaningfulNodes: Array<{ index: number; groupKey: string }> = []

    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]

      if (!this.isMultilineElement(node)) {
        const groupKey = this.getGroupingKey(node)

        if (groupKey) {
          meaningfulNodes.push({ index: i, groupKey })
        }
      }
    }

    let groupStart = 0

    while (groupStart < meaningfulNodes.length) {
      const startGroupKey = meaningfulNodes[groupStart].groupKey
      let groupEnd = groupStart

      while (groupEnd + 1 < meaningfulNodes.length && meaningfulNodes[groupEnd + 1].groupKey === startGroupKey) {
        groupEnd++
      }

      if (groupEnd > groupStart) {
        const groupStartIndex = meaningfulNodes[groupStart].index
        const groupEndIndex = meaningfulNodes[groupEnd].index

        for (let i = groupStart; i <= groupEnd; i++) {
          groupMap.set(meaningfulNodes[i].index, {
            tagName: startGroupKey,
            groupStart: groupStartIndex,
            groupEnd: groupEndIndex
          })
        }
      }

      groupStart = groupEnd + 1
    }

    this.tagGroupsCache.set(siblings, groupMap)

    return groupMap
  }

  /**
   * Determine if spacing should be added between sibling elements
   *
   * This implements the "rule of three" intelligent spacing system:
   * - Adds spacing between 3 or more meaningful siblings
   * - Respects semantic groupings (e.g., ul/li, nav/a stay tight)
   * - Groups comments with following elements
   * - Preserves user-added spacing
   *
   * @param parentElement - The parent element containing the siblings
   * @param siblings - Array of all sibling nodes
   * @param currentIndex - Index of the current node being evaluated
   * @param hasExistingSpacing - Whether user-added spacing already exists
   * @returns true if spacing should be added before the current element
   */
  private shouldAddSpacingBetweenSiblings(parentElement: HTMLElementNode | null, siblings: Node[], currentIndex: number): boolean {
    const currentNode = siblings[currentIndex]
    const previousMeaningfulIndex = findPreviousMeaningfulSibling(siblings, currentIndex)
    const previousNode = previousMeaningfulIndex !== -1 ? siblings[previousMeaningfulIndex] : null

    if (previousNode && (isNode(previousNode, XMLDeclarationNode) || isNode(previousNode, HTMLDoctypeNode))) {
      return true
    }

    const hasMixedContent = siblings.some(child => isNode(child, HTMLTextNode) && child.content.trim() !== "")

    if (hasMixedContent) return false

    const isCurrentComment = isCommentNode(currentNode)
    const isPreviousComment = previousNode ? isCommentNode(previousNode) : false
    const isCurrentMultiline = this.isMultilineElement(currentNode)
    const isPreviousMultiline = previousNode ? this.isMultilineElement(previousNode) : false

    if (isPreviousComment && !isCurrentComment && (isNode(currentNode, HTMLElementNode) || isERBNode(currentNode))) {
      return isPreviousMultiline && isCurrentMultiline
    }

    if (isPreviousComment && isCurrentComment) {
      return false
    }

    if (isCurrentMultiline || isPreviousMultiline) {
      return true
    }

    const meaningfulSiblings = siblings.filter(child => isNonWhitespaceNode(child))
    const parentTagName = parentElement ? getTagName(parentElement) : null
    const isSpaceableContainer = !parentTagName || SPACEABLE_CONTAINERS.has(parentTagName)
    const tagGroups = this.detectTagGroups(siblings)

    const cached = this.allSingleLineCache.get(siblings)
    let allSingleLineHTMLElements: boolean
    if (cached !== undefined) {
      allSingleLineHTMLElements = cached
    } else {
      allSingleLineHTMLElements = meaningfulSiblings.every(node => isNode(node, HTMLElementNode) && !this.isMultilineElement(node))
      this.allSingleLineCache.set(siblings, allSingleLineHTMLElements)
    }

    if (!isSpaceableContainer && meaningfulSiblings.length < 5) {
      return false
    }

    const currentGroup = tagGroups.get(currentIndex)
    const previousGroup = previousNode ? tagGroups.get(previousMeaningfulIndex) : undefined

    if (currentGroup && previousGroup && currentGroup.groupStart === previousGroup.groupStart && currentGroup.groupEnd === previousGroup.groupEnd) {
      return false
    }

    if (previousGroup && previousGroup.groupEnd === previousMeaningfulIndex) {
      return true
    }

    if (allSingleLineHTMLElements && tagGroups.size === 0) {
      return false
    }

    if (isNode(currentNode, HTMLElementNode)) {
      const currentTagName = getTagName(currentNode)

      if (currentTagName && INLINE_ELEMENTS.has(currentTagName)) {
        return false
      }
    }

    const isBlockElement = isBlockLevelNode(currentNode)
    const isERBBlock = isERBNode(currentNode) && isERBControlFlowNode(currentNode)
    const isComment = isCommentNode(currentNode)

    return isBlockElement || isERBBlock || isComment
  }

  /**
   * Check if we're currently processing a token list attribute that needs spacing
   */
  private get isInTokenListAttribute(): boolean {
    return this.currentAttributeName !== null && TOKEN_LIST_ATTRIBUTES.has(this.currentAttributeName)
  }

  /**
   * Render attributes as a space-separated string
   */
  private renderAttributesString(attributes: HTMLAttributeNode[]): string {
    if (attributes.length === 0) return ""

    return ` ${attributes.map(attribute => this.renderAttribute(attribute)).join(" ")}`
  }

  /**
   * Determine if a tag should be rendered inline based on attribute count and other factors
   */
  private shouldRenderInline(
    totalAttributeCount: number,
    inlineLength: number,
    indentLength: number,
    maxLineLength: number = this.maxLineLength,
    hasComplexERB: boolean = false,
    hasMultilineAttributes: boolean = false,
    attributes: HTMLAttributeNode[] = []
  ): boolean {
    if (hasComplexERB || hasMultilineAttributes) return false

    if (totalAttributeCount === 0) {
      return inlineLength + indentLength <= maxLineLength
    }

    if (totalAttributeCount === 1 && attributes.length === 1) {
      const attribute = attributes[0]
      const attributeName = this.getAttributeName(attribute)

      if (attributeName === 'class') {
        const attributeValue = this.getAttributeValue(attribute)
        const wouldBeMultiline = this.wouldClassAttributeBeMultiline(attributeValue, indentLength)

        if (!wouldBeMultiline) {
          return true
        } else {
          return false
        }
      }
    }

    if (totalAttributeCount > 3 || inlineLength + indentLength > maxLineLength) {
      return false
    }

    return true
  }

  private wouldClassAttributeBeMultiline(content: string, indentLength: number): boolean {
    const normalizedContent = content.replace(ASCII_WHITESPACE, ' ').trim()
    const hasActualNewlines = /\r?\n/.test(content)

    if (hasActualNewlines && normalizedContent.length > 80) {
      const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line)

      if (lines.length > 1) {
        return true
      }
    }

    const attributeLine = `class="${normalizedContent}"`
    const currentIndent = indentLength

    if (currentIndent + attributeLine.length > this.maxLineLength && normalizedContent.length > 60) {
      if (/<%[^%]*%>/.test(normalizedContent)) {
        return false
      }

      const classes = normalizedContent.split(' ')
      const lines = this.breakTokensIntoLines(classes, currentIndent)
      return lines.length > 1
    }

    return false
  }

  // TOOD: extract to core or reuse function from core
  private getAttributeName(attribute: HTMLAttributeNode): string {
    return attribute.name ? getCombinedAttributeName(attribute.name) : ""
  }

  // TOOD: extract to core or reuse function from core
  private getAttributeValue(attribute: HTMLAttributeNode): string {
    if (isNode(attribute.value, HTMLAttributeValueNode)) {
      return attribute.value.children.map(child => isNode(child, HTMLTextNode) ? child.content : IdentityPrinter.print(child)).join('')
    }

    return ''
  }

  private hasMultilineAttributes(attributes: HTMLAttributeNode[]): boolean {
    return attributes.some(attribute => {
      if (isNode(attribute.value, HTMLAttributeValueNode)) {
        const content = getCombinedStringFromNodes(attribute.value.children)

        if (/\r?\n/.test(content)) {
          const name = attribute.name ? getCombinedAttributeName(attribute.name) : ""

          if (name === "class") {
            const normalizedContent = content.replace(ASCII_WHITESPACE, ' ').trim()

            return normalizedContent.length > 80
          }

          const lines = content.split(/\r?\n/)

          if (lines.length > 1) {
            return lines.slice(1).some(line => /^[ \t\n\r]+/.test(line))
          }
        }
      }

      return false
    })
  }

  private formatClassAttribute(content: string, name: string, equals: string, open_quote: string, close_quote: string): string {
    const normalizedContent = content.replace(ASCII_WHITESPACE, ' ').trim()
    const hasActualNewlines = /\r?\n/.test(content)

    if (hasActualNewlines && normalizedContent.length > 80) {
      const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line)

      if (lines.length > 1) {
        return open_quote + this.formatMultilineAttributeValue(lines) + close_quote
      }
    }

    const currentIndent = this.indentLevel * this.indentWidth
    const attributeLine = `${name}${equals}${open_quote}${normalizedContent}${close_quote}`

    if (currentIndent + attributeLine.length > this.maxLineLength && normalizedContent.length > 60) {
      if (/<%[^%]*%>/.test(normalizedContent)) {
        return open_quote + normalizedContent + close_quote
      }

      const classes = normalizedContent.split(' ')
      const lines = this.breakTokensIntoLines(classes, currentIndent)

      if (lines.length > 1) {
        return open_quote + this.formatMultilineAttributeValue(lines) + close_quote
      }
    }

    return open_quote + normalizedContent + close_quote
  }

  private isFormattableAttribute(attributeName: string, tagName: string): boolean {
    const globalFormattable = FORMATTABLE_ATTRIBUTES['*'] || []
    const tagSpecificFormattable = FORMATTABLE_ATTRIBUTES[tagName.toLowerCase()] || []

    return globalFormattable.includes(attributeName) || tagSpecificFormattable.includes(attributeName)
  }

  private formatMultilineAttribute(content: string, name: string, open_quote: string, close_quote: string): string {
    if (name === 'srcset' || name === 'sizes') {
      const normalizedContent = content.replace(ASCII_WHITESPACE, ' ').trim()

      return open_quote + normalizedContent + close_quote
    }

    const lines = content.split('\n')

    if (lines.length <= 1) {
      return open_quote + content + close_quote
    }

    const formattedContent = this.formatMultilineAttributeValue(lines)

    return open_quote + formattedContent + close_quote
  }

  private formatMultilineAttributeValue(lines: string[]): string {
    const indent = " ".repeat((this.indentLevel + 1) * this.indentWidth)
    const closeIndent = " ".repeat(this.indentLevel * this.indentWidth)

    return "\n" + lines.map(line => indent + line).join("\n") + "\n" + closeIndent
  }

  private breakTokensIntoLines(tokens: string[], currentIndent: number, separator: string = ' '): string[] {
    const lines: string[] = []
    let currentLine = ''

    for (const token of tokens) {
      const testLine = currentLine ? currentLine + separator + token : token

      if (testLine.length > (this.maxLineLength - currentIndent - 6)) {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = token
        } else {
          lines.push(token)
        }
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) lines.push(currentLine)

    return lines
  }

  /**
   * Render multiline attributes for a tag
   */
  private renderMultilineAttributes(tagName: string, allChildren: Node[] = [], isSelfClosing: boolean = false,) {
    const herbDisableComments = allChildren.filter(child =>
      isNode(child, ERBContentNode) && isHerbDisableComment(child)
    )

    let openingLine = `<${tagName}`

    if (herbDisableComments.length > 0) {
      const commentLines = this.capture(() => {
        herbDisableComments.forEach(comment => {
          const wasInlineMode = this.inlineMode
          this.inlineMode = true
          this.lines.push(" ")
          this.visit(comment)
          this.inlineMode = wasInlineMode
        })
      })

      openingLine += commentLines.join("")
    }

    this.pushWithIndent(openingLine)

    this.withIndent(() => {
      allChildren.forEach(child => {
        if (isNode(child, HTMLAttributeNode)) {
          this.pushWithIndent(this.renderAttribute(child))
        } else if (!isNode(child, WhitespaceNode)) {
          if (isNode(child, ERBContentNode) && isHerbDisableComment(child)) {
            return
          }

          this.visit(child)
        }
      })
    })

    if (isSelfClosing) {
      this.pushWithIndent("/>")
    } else {
      this.pushWithIndent(">")
    }
  }

  /**
   * Reconstruct the text representation of an ERB node
   * @param withFormatting - if true, format the content; if false, preserve original
   */
  private reconstructERBNode(node: ERBNode, withFormatting: boolean = true): string {
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const content = node.content?.value ?? ""
    const inner = withFormatting ? this.formatERBContent(content) : content

    return open + inner + close
  }

  /**
   * Print an ERB tag (<% %> or <%= %>) with single spaces around inner content.
   */
  printERBNode(node: ERBNode) {
    const indent = this.inlineMode ? "" : this.indent
    const erbText = this.reconstructERBNode(node, true)

    this.push(indent + erbText)
  }

  // --- Visitor methods ---

  visitDocumentNode(node: DocumentNode) {
    const children = this.formatFrontmatter(node)
    const hasTextFlow = this.isInTextFlowContext(null, children)

    if (hasTextFlow) {
      const wasInlineMode = this.inlineMode
      this.inlineMode = true

      this.visitTextFlowChildren(children)

      this.inlineMode = wasInlineMode

      return
    }

    let lastMeaningfulNode: Node | null = null
    let hasHandledSpacing = false

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (shouldPreserveUserSpacing(child, children, i)) {
        this.push("")
        hasHandledSpacing = true
        continue
      }

      if (isPureWhitespaceNode(child)) {
        continue
      }

      if (shouldAppendToLastLine(child, children, i)) {
        this.appendChildToLastLine(child, children, i)
        lastMeaningfulNode = child
        hasHandledSpacing = false
        continue
      }

      if (!isNonWhitespaceNode(child)) continue

      const childStartLine = this.stringLineCount
      this.visit(child)

      if (lastMeaningfulNode && !hasHandledSpacing) {
        const shouldAddSpacing = this.shouldAddSpacingBetweenSiblings( null, children, i)

        if (shouldAddSpacing) {
          this.lines.splice(childStartLine, 0, "")
          this.stringLineCount++
        }
      }

      lastMeaningfulNode = child
      hasHandledSpacing = false
    }
  }

  visitHTMLElementNode(node: HTMLElementNode) {
    this.elementStack.push(node)
    this.elementFormattingAnalysis.set(node, this.analyzeElementFormatting(node))

    this.trackBoundary(node, () => {
      if (this.inlineMode && node.is_void && this.indentLevel === 0) {
        const openTag = this.capture(() => this.visit(node.open_tag)).join('')
        this.pushToLastLine(openTag)
        return
      }

      this.visit(node.open_tag)

      if (node.body.length > 0) {
        this.visitHTMLElementBody(node.body, node)
      }

      if (node.close_tag) {
        this.visit(node.close_tag)
      }
    })

    this.elementStack.pop()
  }

  visitHTMLConditionalElementNode(node: HTMLConditionalElementNode) {
    this.trackBoundary(node, () => {
      if (node.open_conditional) {
        this.visit(node.open_conditional)
      }

      if (node.body.length > 0) {
        this.push("")

        this.withIndent(() => {
          for (const child of node.body) {
            if (!isPureWhitespaceNode(child)) {
              this.visit(child)
            }
          }
        })

        this.push("")
      }

      if (node.close_conditional) {
        this.visit(node.close_conditional)
      }
    })
  }

  visitHTMLConditionalOpenTagNode(node: HTMLConditionalOpenTagNode) {
    const wasInConditionalOpenTagContext = this.inConditionalOpenTagContext
    this.inConditionalOpenTagContext = true

    this.trackBoundary(node, () => {
      if (node.conditional) {
        this.visit(node.conditional)
      }
    })

    this.inConditionalOpenTagContext = wasInConditionalOpenTagContext
  }

  visitHTMLElementBody(body: Node[], element: HTMLElementNode) {
    const tagName = getTagName(element)

    if (isContentPreserving(element)) {
      element.body.map(child => {
        if (isNode(child, HTMLElementNode)) {
          const wasInlineMode = this.inlineMode
          this.inlineMode = true

          const formattedElement = this.capture(() => this.visit(child)).join("")
          this.pushToLastLine(formattedElement)

          this.inlineMode = wasInlineMode
        } else {
          this.pushToLastLine(IdentityPrinter.print(child))
        }
      })

      return
    }

    const analysis = this.elementFormattingAnalysis.get(element)
    const hasTextFlow = this.isInTextFlowContext(null, body)
    const children = filterSignificantChildren(body)

    if (analysis?.elementContentInline) {
      if (children.length === 0) return

      const oldInlineMode = this.inlineMode
      const nodesToRender = hasTextFlow ? body : children

      const hasOnlyTextContent = nodesToRender.every(child => isNode(child, HTMLTextNode) || isNode(child, WhitespaceNode))
      const shouldPreserveSpaces = hasOnlyTextContent && isInlineElement(tagName)

      this.inlineMode = true

      const lines = this.capture(() => {
        nodesToRender.forEach(child => {
          if (isNode(child, HTMLTextNode)) {
            if (hasTextFlow) {
              const normalizedContent = child.content.replace(ASCII_WHITESPACE, ' ')

              if (normalizedContent && normalizedContent !== ' ') {
                this.push(normalizedContent)
              } else if (normalizedContent === ' ') {
                this.push(' ')
              }
            } else {
              const normalizedContent = child.content.replace(ASCII_WHITESPACE, ' ')

              if (shouldPreserveSpaces && normalizedContent) {
                this.push(normalizedContent)
              } else {
                const trimmedContent = normalizedContent.trim()

                if (trimmedContent) {
                  this.push(trimmedContent)
                } else if (normalizedContent === ' ') {
                  this.push(' ')
                }
              }
            }
          } else if (isNode(child, WhitespaceNode)) {
            return
          } else {
            this.visit(child)
          }
        })
      })

      const content = lines.join('')

      const inlineContent = shouldPreserveSpaces
        ? (hasTextFlow ? content.replace(ASCII_WHITESPACE, ' ') : content)
        : (hasTextFlow ? content.replace(ASCII_WHITESPACE, ' ').trim() : content.trim())

      if (inlineContent) {
        this.pushToLastLine(inlineContent)
      }

      this.inlineMode = oldInlineMode

      return
    }

    if (children.length === 0) return

    let leadingHerbDisableComment: Node | null = null
    let leadingHerbDisableIndex = -1
    let firstWhitespaceIndex = -1
    let remainingChildren = children
    let remainingBodyUnfiltered = body

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (isNode(child, WhitespaceNode) || isPureWhitespaceNode(child)) {
        if (firstWhitespaceIndex < 0) {
          firstWhitespaceIndex = i
        }

        continue
      }

      if (isNode(child, ERBContentNode) && isHerbDisableComment(child)) {
        leadingHerbDisableComment = child
        leadingHerbDisableIndex = i
      }

      break
    }

    if (leadingHerbDisableComment && leadingHerbDisableIndex >= 0) {
      remainingChildren = children.filter((_, index) => {
        if (index === leadingHerbDisableIndex) return false

        if (firstWhitespaceIndex >= 0 && index === leadingHerbDisableIndex - 1) {
          const child = children[index]

          if (isNode(child, WhitespaceNode) || isPureWhitespaceNode(child)) {
            return false
          }
        }

        return true
      })

      remainingBodyUnfiltered = body.filter((_, index) => {
        if (index === leadingHerbDisableIndex) return false

        if (firstWhitespaceIndex >= 0 && index === leadingHerbDisableIndex - 1) {
          const child = body[index]

          if (isNode(child, WhitespaceNode) || isPureWhitespaceNode(child)) {
            return false
          }
        }

        return true
      })
    }

    if (leadingHerbDisableComment) {
      const herbDisableString = this.capture(() => {
        const savedIndentLevel = this.indentLevel
        this.indentLevel = 0
        this.inlineMode = true
        this.visit(leadingHerbDisableComment)
        this.inlineMode = false
        this.indentLevel = savedIndentLevel
      }).join("")

      const hasLeadingWhitespace = firstWhitespaceIndex >= 0 && firstWhitespaceIndex < leadingHerbDisableIndex

      this.pushToLastLine((hasLeadingWhitespace ? ' ' : '') + herbDisableString)
    }

    if (remainingChildren.length === 0) return

    this.withIndent(() => {
      if (hasTextFlow) {
        this.visitTextFlowChildren(remainingBodyUnfiltered)
      } else {
        this.visitElementChildren(leadingHerbDisableComment ? remainingChildren : body, element)
      }
    })
  }

  /**
   * Visit element children with intelligent spacing logic
   *
   * Tracks line positions and immediately splices blank lines after rendering each child.
   */
  private visitElementChildren(body: Node[], parentElement: HTMLElementNode | null) {
    let lastMeaningfulNode: Node | null = null
    let hasHandledSpacing = false

    for (let index = 0; index < body.length; index++) {
      const child = body[index]

      if (isNode(child, HTMLTextNode)) {
        const isWhitespaceOnly = child.content.trim() === ""

        if (isWhitespaceOnly) {
          const hasPreviousNonWhitespace = index > 0 && isNonWhitespaceNode(body[index - 1])
          const hasNextNonWhitespace = index < body.length - 1 && isNonWhitespaceNode(body[index + 1])
          const hasMultipleNewlines = child.content.includes('\n\n')

          if (hasPreviousNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
            this.push("")
            hasHandledSpacing = true
          }

          continue
        }
      }

      if (!isNonWhitespaceNode(child)) continue

      let hasTrailingHerbDisable = false

      if (isNode(child, HTMLElementNode) && child.close_tag) {
        for (let j = index + 1; j < body.length; j++) {
          const nextChild = body[j]

          if (isNode(nextChild, WhitespaceNode) || isPureWhitespaceNode(nextChild)) {
            continue
          }

          if (isNode(nextChild, ERBContentNode) && isHerbDisableComment(nextChild)) {
            hasTrailingHerbDisable = true

            const childStartLine = this.stringLineCount
            this.visit(child)

            if (lastMeaningfulNode && !hasHandledSpacing) {
              const shouldAddSpacing = this.shouldAddSpacingBetweenSiblings(parentElement, body, index)

              if (shouldAddSpacing) {
                this.lines.splice(childStartLine, 0, "")
                this.stringLineCount++
              }
            }

            const herbDisableString = this.capture(() => {
              const savedIndentLevel = this.indentLevel
              this.indentLevel = 0
              this.inlineMode = true
              this.visit(nextChild)
              this.inlineMode = false
              this.indentLevel = savedIndentLevel
            }).join("")

            this.pushToLastLine(' ' + herbDisableString)

            index = j
            lastMeaningfulNode = child
            hasHandledSpacing = false

            break
          }

          break
        }
      }

      if (!hasTrailingHerbDisable) {
        const childStartLine = this.stringLineCount
        this.visit(child)

        if (lastMeaningfulNode && !hasHandledSpacing) {
          const shouldAddSpacing = this.shouldAddSpacingBetweenSiblings(parentElement, body, index)

          if (shouldAddSpacing) {
            this.lines.splice(childStartLine, 0, "")
            this.stringLineCount++
          }
        }

        lastMeaningfulNode = child
        hasHandledSpacing = false
      }
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode) {
    const attributes = filterNodes(node.children, HTMLAttributeNode)
    const inlineNodes = this.extractInlineNodes(node.children)
    const isSelfClosing = node.tag_closing?.value === "/>"

    if (this.inConditionalOpenTagContext) {
      const inline = this.renderInlineOpen(getTagName(node), attributes, isSelfClosing, inlineNodes, node.children)
      this.push(this.indent + inline)
      return
    }

    if (this.currentElement && this.elementFormattingAnalysis.has(this.currentElement)) {
      const analysis = this.elementFormattingAnalysis.get(this.currentElement)!

      if (analysis.openTagInline) {
        const inline = this.renderInlineOpen(getTagName(node), attributes, isSelfClosing, inlineNodes, node.children)

        this.push(this.inlineMode ? inline : this.indent + inline)
        return
      } else {
        this.renderMultilineAttributes(getTagName(node), node.children, isSelfClosing)

        return
      }
    }

    const inline = this.renderInlineOpen(getTagName(node), attributes, isSelfClosing, inlineNodes, node.children)
    const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)
    const shouldKeepInline = this.shouldRenderInline(
      totalAttributeCount,
      inline.length,
      this.indent.length,
      this.maxLineLength,
      false,
      this.hasMultilineAttributes(attributes),
      attributes
    )

    if (shouldKeepInline) {
      this.push(this.inlineMode ? inline : this.indent + inline)
    } else {
      this.renderMultilineAttributes(getTagName(node), node.children, isSelfClosing)
    }
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode) {
    const closingTag = IdentityPrinter.print(node)
    const analysis = this.currentElement && this.elementFormattingAnalysis.get(this.currentElement)
    const closeTagInline = analysis?.closeTagInline

    if (this.currentElement && closeTagInline) {
      this.pushToLastLine(closingTag)
    } else {
      this.pushWithIndent(closingTag)
    }
  }

  visitHTMLTextNode(node: HTMLTextNode) {
    if (this.inlineMode) {
      const normalizedContent = node.content.replace(ASCII_WHITESPACE, ' ').trim()

      if (normalizedContent) {
        this.push(normalizedContent)
      }

      return
    }

    const text = node.content.trim()

    if (!text) return

    const wrapWidth = this.maxLineLength - this.indent.length
    const words = text.split(/[ \t\n\r]+/)
    const lines: string[] = []

    let line = ""

    for (const word of words) {
      if ((line + (line ? " " : "") + word).length > wrapWidth && line) {
        lines.push(this.indent + line)
        line = word
      } else {
        line += (line ? " " : "") + word
      }
    }

    if (line) lines.push(this.indent + line)

    lines.forEach(line => this.push(line))
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode) {
    this.pushWithIndent(this.renderAttribute(node))
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode) {
    this.pushWithIndent(getCombinedAttributeName(node))
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode) {
    this.pushWithIndent(IdentityPrinter.print(node))
  }

  // TODO: rework
  visitHTMLCommentNode(node: HTMLCommentNode) {
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""

    let inner: string

    if (node.children && node.children.length > 0) {
      inner = node.children.map(child => {
        if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
          return child.content
        } else if (isERBNode(child)) {
          return IdentityPrinter.print(child)
        } else {
          return ""
        }
      }).join("")

      const trimmedInner = inner.trim()

      if (trimmedInner.startsWith('[if ') && trimmedInner.endsWith('<![endif]')) {
        this.pushWithIndent(open + inner + close)

        return
      }

      const hasNewlines = inner.includes('\n')

      if (hasNewlines) {
        const lines = inner.split('\n')
        const childIndent = " ".repeat(this.indentWidth)
        const firstLineHasContent = lines[0].trim() !== ''

        if (firstLineHasContent && lines.length > 1) {
          const contentLines = lines.map(line => line.trim()).filter(line => line !== '')
          inner = '\n' + contentLines.map(line => childIndent + line).join('\n') + '\n'
        } else {
          const contentLines = lines.filter((line, index) => {
            return line.trim() !== '' && !(index === 0 || index === lines.length - 1)
          })

          const minIndent = contentLines.length > 0 ? Math.min(...contentLines.map(line => line.length - line.trimStart().length)) : 0

          const processedLines = lines.map((line, index) => {
            const trimmedLine = line.trim()

            if ((index === 0 || index === lines.length - 1) && trimmedLine === '') {
              return line
            }

            if (trimmedLine !== '') {
              const currentIndent = line.length - line.trimStart().length
              const relativeIndent = Math.max(0, currentIndent - minIndent)

              return childIndent + " ".repeat(relativeIndent) + trimmedLine
            }

            return line
          })

          inner = processedLines.join('\n')
        }
      } else {
        inner = ` ${inner.trim()} `
      }
    } else {
      inner = ""
    }

    this.pushWithIndent(open + inner + close)
  }

  visitERBCommentNode(node: ERBContentNode) {
    const open = node.tag_opening?.value || "<%#"
    const content = node?.content?.value || ""
    const close = node.tag_closing?.value || "%>"

    const contentLines = content.split("\n")
    const contentTrimmedLines = content.trim().split("\n")

    if (contentLines.length === 1 && contentTrimmedLines.length === 1) {
      const startsWithSpace = content[0] === " "
      const before = startsWithSpace ? "" : " "

      if (this.inlineMode) {
        this.push(open + before + content.trimEnd() + ' ' + close)
      } else {
        this.pushWithIndent(open + before + content.trimEnd() + ' ' + close)
      }

      return
    }

    if (contentTrimmedLines.length === 1) {
      if (this.inlineMode) {
        this.push(open + ' ' + content.trim() + ' ' + close)
      } else {
        this.pushWithIndent(open + ' ' + content.trim() + ' ' + close)
      }

      return
    }

    const firstLineEmpty = contentLines[0].trim() === ""
    const dedentedContent = dedent(firstLineEmpty ? content : content.trimStart())

    this.pushWithIndent(open)

    this.withIndent(() => {
      dedentedContent.split("\n").forEach(line => this.pushWithIndent(line))
    })

    this.pushWithIndent(close)
  }

  visitHTMLDoctypeNode(node: HTMLDoctypeNode) {
    this.pushWithIndent(IdentityPrinter.print(node))
  }

  visitXMLDeclarationNode(node: XMLDeclarationNode) {
    this.pushWithIndent(IdentityPrinter.print(node))
  }

  visitCDATANode(node: CDATANode) {
    this.pushWithIndent(IdentityPrinter.print(node))
  }

  visitERBContentNode(node: ERBContentNode) {
    if (isERBCommentNode(node)) {
      this.visitERBCommentNode(node)
    } else {
      this.printERBNode(node)
    }
  }

  visitERBEndNode(node: ERBEndNode) {
    this.printERBNode(node)
  }

  visitERBYieldNode(node: ERBYieldNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
    })
  }

  visitERBInNode(node: ERBInNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))
    })
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)

      this.withIndent(() => this.visitAll(node.children))
      this.visitAll(node.conditions)

      if (node.else_clause) this.visit(node.else_clause)
      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBBlockNode(node: ERBBlockNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)

      this.withIndent(() => {
        const hasTextFlow = this.isInTextFlowContext(null, node.body)

        if (hasTextFlow) {
          this.visitTextFlowChildren(node.body)
        } else {
          this.visitElementChildren(node.body, null)
        }
      })

      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBIfNode(node: ERBIfNode) {
    this.trackBoundary(node, () => {
      if (this.inlineMode) {
        this.printERBNode(node)

        node.statements.forEach(child => {
          if (isNode(child, HTMLAttributeNode)) {
            this.lines.push(" ")
            this.lines.push(this.renderAttribute(child))
          } else {
            const shouldAddSpaces = this.isInTokenListAttribute

            if (shouldAddSpaces) {
              this.lines.push(" ")
            }

            this.visit(child)

            if (shouldAddSpaces) {
              this.lines.push(" ")
            }
          }
        })

        const hasHTMLAttributes = node.statements.some(child => isNode(child, HTMLAttributeNode))
        const isTokenList = this.isInTokenListAttribute

        if ((hasHTMLAttributes || isTokenList) && node.end_node) {
          this.lines.push(" ")
        }

        if (node.subsequent) this.visit(node.subsequent)
        if (node.end_node) this.visit(node.end_node)
      } else {
        this.printERBNode(node)

        this.withIndent(() => {
          node.statements.forEach(child => this.visit(child))
        })

        if (node.subsequent) this.visit(node.subsequent)
        if (node.end_node) this.visit(node.end_node)
      }
    })
  }

  visitERBElseNode(node: ERBElseNode) {
    this.printERBNode(node)

    if (this.inlineMode) {
      this.visitAll(node.statements)
    } else {
      this.withIndent(() => this.visitAll(node.statements))
    }
  }

  visitERBWhenNode(node: ERBWhenNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))
  }

  visitERBCaseNode(node: ERBCaseNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)

      this.withIndent(() => this.visitAll(node.children))
      this.visitAll(node.conditions)

      if (node.else_clause) this.visit(node.else_clause)
      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBBeginNode(node: ERBBeginNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))

      if (node.rescue_clause) this.visit(node.rescue_clause)
      if (node.else_clause) this.visit(node.else_clause)
      if (node.ensure_clause) this.visit(node.ensure_clause)
      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBWhileNode(node: ERBWhileNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))

      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBUntilNode(node: ERBUntilNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))

      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBForNode(node: ERBForNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))

      if (node.end_node) this.visit(node.end_node)
    })
  }

  visitERBRescueNode(node: ERBRescueNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))
  }

  visitERBEnsureNode(node: ERBEnsureNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))
  }

  visitERBUnlessNode(node: ERBUnlessNode) {
    this.trackBoundary(node, () => {
      this.printERBNode(node)
      this.withIndent(() => this.visitAll(node.statements))

      if (node.else_clause) this.visit(node.else_clause)
      if (node.end_node) this.visit(node.end_node)
    })
  }

  // --- Element Formatting Analysis Helpers ---

  /**
   * Analyzes an HTMLElementNode and returns formatting decisions for all parts
   */
  private analyzeElementFormatting(node: HTMLElementNode): ElementFormattingAnalysis {
    const openTagInline = this.shouldRenderOpenTagInline(node)
    const elementContentInline = this.shouldRenderElementContentInline(node)
    const closeTagInline = this.shouldRenderCloseTagInline(node, elementContentInline)

    return {
      openTagInline,
      elementContentInline,
      closeTagInline
    }
  }

  /**
   * Determines if the open tag should be rendered inline
   */
  private shouldRenderOpenTagInline(node: HTMLElementNode): boolean {
    if (isNode(node.open_tag, HTMLConditionalOpenTagNode)) {
      return false
    }

    const openTag = node.open_tag
    const children = openTag?.children || []
    const attributes = filterNodes(children, HTMLAttributeNode)
    const inlineNodes = this.extractInlineNodes(children)
    const hasERBControlFlow = inlineNodes.some(node => isERBControlFlowNode(node)) || children.some(node => isERBControlFlowNode(node))
    const hasComplexERB = hasERBControlFlow && hasComplexERBControlFlow(inlineNodes)

    if (hasComplexERB) return false

    const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)
    const hasMultilineAttrs = this.hasMultilineAttributes(attributes)

    if (hasMultilineAttrs) return false

    const inline = this.renderInlineOpen(
      getTagName(node),
      attributes,
      openTag?.tag_closing?.value === "/>",
      inlineNodes,
      children
    )

    return this.shouldRenderInline(
      totalAttributeCount,
      inline.length,
      this.indent.length,
      this.maxLineLength,
      hasComplexERB,
      hasMultilineAttrs,
      attributes
    )
  }

  /**
   * Determines if the element content should be rendered inline
   */
  private shouldRenderElementContentInline(node: HTMLElementNode): boolean {
    const tagName = getTagName(node)
    const children = filterSignificantChildren(node.body)
    const openTagInline = this.shouldRenderOpenTagInline(node)

    if (!openTagInline) return false
    if (children.length === 0) return true

    const hasNonInlineChildElements = children.some(child => {
      if (isNode(child, HTMLElementNode)) {
        return !this.shouldRenderElementContentInline(child)
      }

      return false
    })

    if (hasNonInlineChildElements) return false

    let hasLeadingHerbDisable = false

    for (const child of node.body) {
      if (isNode(child, WhitespaceNode) || isPureWhitespaceNode(child)) {
        continue
      }
      if (isNode(child, ERBContentNode) && isHerbDisableComment(child)) {
        hasLeadingHerbDisable = true
      }
      break
    }

    if (hasLeadingHerbDisable && !isInlineElement(tagName)) {
      return false
    }

    if (isInlineElement(tagName)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(getOpenTagChildren(node), HTMLAttributeNode), node.body)

      if (fullInlineResult) {
        const totalLength = this.indent.length + fullInlineResult.length
        return totalLength <= this.maxLineLength
      }

      return false
    }

    if (SPACEABLE_CONTAINERS.has(tagName)) {
      const allChildrenAreERB = children.length > 1 && children.every(child => isERBNode(child))

      if (allChildrenAreERB) return false
    }

    const allNestedAreInline = areAllNestedElementsInline(children)
    const hasMultilineText = hasMultilineTextContent(children)
    const hasMixedContent = hasMixedTextAndInlineContent(children)

    if (allNestedAreInline && (!hasMultilineText || hasMixedContent)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(getOpenTagChildren(node), HTMLAttributeNode), node.body)

      if (fullInlineResult) {
        const totalLength = this.indent.length + fullInlineResult.length

        if (totalLength <= this.maxLineLength) {
          return true
        }
      }
    }

    const inlineResult = this.tryRenderInline(children, tagName)

    if (inlineResult) {
      const openTagResult = this.renderInlineOpen(
        tagName,
        filterNodes(getOpenTagChildren(node), HTMLAttributeNode),
        false,
        [],
        getOpenTagChildren(node)
      )

      const childrenContent = this.renderChildrenInline(children)
      const fullLine = openTagResult + childrenContent + `</${tagName}>`
      const totalLength = this.indent.length + fullLine.length

      if (totalLength <= this.maxLineLength) {
        return true
      }
    }

    return false
  }

  /**
   * Determines if the close tag should be rendered inline (usually follows content decision)
   */
  private shouldRenderCloseTagInline(node: HTMLElementNode, elementContentInline: boolean): boolean {
    if (node.is_void) return true
    if (getOpenTagClosing(node)?.value === "/>") return true
    if (isContentPreserving(node)) return true

    const children = filterSignificantChildren(node.body)

    if (children.length === 0) return true

    return elementContentInline
  }


  // --- Utility methods ---

  private formatFrontmatter(node: DocumentNode): Node[] {
    const firstChild = node.children[0]
    const hasFrontmatter = firstChild && isFrontmatter(firstChild)

    if (!hasFrontmatter) return node.children

    this.push(firstChild.content.trimEnd())

    const remaining = node.children.slice(1)

    if (remaining.length > 0) this.push("")

    return remaining
  }

  /**
   * Append a child node to the last output line
   */
  private appendChildToLastLine(child: Node, siblings?: Node[], index?: number): void {
    if (isNode(child, HTMLTextNode)) {
      this.pushToLastLine(child.content.trim())
    } else {
      let hasSpaceBefore = false

      if (siblings && index !== undefined && index > 0) {
        const prevSibling = siblings[index - 1]

        if (isPureWhitespaceNode(prevSibling) || isNode(prevSibling, WhitespaceNode)) {
          hasSpaceBefore = true
        }
      }

      const oldInlineMode = this.inlineMode
      this.inlineMode = true
      const inlineContent = this.capture(() => this.visit(child)).join("")
      this.inlineMode = oldInlineMode
      this.pushToLastLine((hasSpaceBefore ? " " : "") + inlineContent)
    }
  }

  /**
   * Visit children in a text flow context (mixed text and inline elements)
   * Handles word wrapping and keeps adjacent inline elements together
   */
  private visitTextFlowChildren(children: Node[]) {
    const adjacentInlineCount = countAdjacentInlineElements(children)

    if (adjacentInlineCount >= 2) {
      const { processedIndices } = this.renderAdjacentInlineElements(children, adjacentInlineCount)
      this.visitRemainingChildren(children, processedIndices)

      return
    }

    this.buildAndWrapTextFlow(children)
  }

  /**
   * Wrap remaining words that don't fit on the current line
   * Returns the wrapped lines with proper indentation
   */
  private wrapRemainingWords(words: string[], wrapWidth: number): string[] {
    const lines: string[] = []
    let line = ""

    for (const word of words) {
      const testLine = line + (line ? " " : "") + word

      if (testLine.length > wrapWidth && line) {
        lines.push(this.indent + line)
        line = word
      } else {
        line = testLine
      }
    }

    if (line) {
      lines.push(this.indent + line)
    }

    return lines
  }

  /**
   * Try to merge text starting with punctuation to inline content
   * Returns object with merged content and whether processing should stop
   */
  private tryMergePunctuationText(inlineContent: string, trimmedText: string, wrapWidth: number): { mergedContent: string, shouldStop: boolean, wrappedLines: string[] } {
    const combined = inlineContent + trimmedText

    if (combined.length <= wrapWidth) {
      return {
        mergedContent: inlineContent + trimmedText,
        shouldStop: false,
        wrappedLines: []
      }
    }

    const match = trimmedText.match(/^[.!?:;]+/)

    if (!match) {
      return {
        mergedContent: inlineContent,
        shouldStop: false,
        wrappedLines: []
      }
    }

    const punctuation = match[0]
    const restText = trimmedText.substring(punctuation.length).trim()

    if (!restText) {
      return {
        mergedContent: inlineContent + punctuation,
        shouldStop: false,
        wrappedLines: []
      }
    }

    const words = restText.split(/[ \t\n\r]+/)
    let toMerge = punctuation
    let mergedWordCount = 0

    for (const word of words) {
      const testMerge = toMerge + ' ' + word

      if ((inlineContent + testMerge).length <= wrapWidth) {
        toMerge = testMerge
        mergedWordCount++
      } else {
        break
      }
    }

    const mergedContent = inlineContent + toMerge

    if (mergedWordCount >= words.length) {
      return {
        mergedContent,
        shouldStop: false,
        wrappedLines: []
      }
    }

    const remainingWords = words.slice(mergedWordCount)
    const wrappedLines = this.wrapRemainingWords(remainingWords, wrapWidth)

    return {
      mergedContent,
      shouldStop: true,
      wrappedLines
    }
  }

  /**
   * Render adjacent inline elements together on one line
   */
  private renderAdjacentInlineElements(children: Node[], count: number): { processedIndices: Set<number> } {
    let inlineContent = ""
    let processedCount = 0
    let lastProcessedIndex = -1
    const processedIndices = new Set<number>()

    for (let index = 0; index < children.length && processedCount < count; index++) {
      const child = children[index]

      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        continue
      }

      if (isNode(child, HTMLElementNode) && isInlineElement(getTagName(child))) {
        inlineContent += this.renderInlineElementAsString(child)
        processedCount++
        lastProcessedIndex = index
        processedIndices.add(index)

        if (inlineContent && isLineBreakingElement(child)) {
          this.pushWithIndent(inlineContent)
          inlineContent = ""
        }
      } else if (isNode(child, ERBContentNode)) {
        inlineContent += this.renderERBAsString(child)
        processedCount++
        lastProcessedIndex = index
        processedIndices.add(index)
      }
    }

    if (lastProcessedIndex >= 0) {
      for (let index = lastProcessedIndex + 1; index < children.length; index++) {
        const child = children[index]

        if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
          continue
        }

        if (isNode(child, ERBContentNode)) {
          inlineContent += this.renderERBAsString(child)
          processedIndices.add(index)
          continue
        }

        if (isNode(child, HTMLTextNode)) {
          const trimmed = child.content.trim()

          if (trimmed && /^[.!?:;]/.test(trimmed)) {
            const wrapWidth = this.maxLineLength - this.indent.length
            const result = this.tryMergePunctuationText(inlineContent, trimmed, wrapWidth)

            inlineContent = result.mergedContent
            processedIndices.add(index)

            if (result.shouldStop) {
              if (inlineContent) {
                this.pushWithIndent(inlineContent)
              }

              result.wrappedLines.forEach(line => this.push(line))

              return { processedIndices }
            }
          }
        }

        break
      }
    }

    if (inlineContent) {
      this.pushWithIndent(inlineContent)
    }

    return { processedIndices }
  }

  /**
   * Render an inline element as a string
   */
  private renderInlineElementAsString(element: HTMLElementNode): string {
    const tagName = getTagName(element)
    const tagClosing = getOpenTagClosing(element)

    if (element.is_void || tagClosing?.value === "/>") {
      const attributes = filterNodes(getOpenTagChildren(element), HTMLAttributeNode)
      const attributesString = this.renderAttributesString(attributes)
      const isSelfClosing = tagClosing?.value === "/>"

      return `<${tagName}${attributesString}${isSelfClosing ? " />" : ">"}`
    }

    const childrenToRender = this.getFilteredChildren(element.body)

    const childInline = this.tryRenderInlineFull(element, tagName,
      filterNodes(getOpenTagChildren(element), HTMLAttributeNode),
      childrenToRender
    )

    return childInline !== null ? childInline : ""
  }

  /**
   * Render an ERB node as a string
   */
  private renderERBAsString(node: ERBContentNode): string {
    return this.capture(() => {
      this.inlineMode = true
      this.visit(node)
    }).join("")
  }

  /**
   * Visit remaining children after processing adjacent inline elements
   */
  private visitRemainingChildren(children: Node[], processedIndices: Set<number>): void {
    for (let index = 0; index < children.length; index++) {
      const child = children[index]

      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        continue
      }

      if (processedIndices.has(index)) {
        continue
      }

      this.visit(child)
    }
  }

  /**
   * Build words array from text/inline/ERB and wrap them
   */
  private buildAndWrapTextFlow(children: Node[]): void {
    const unitsWithNodes: ContentUnitWithNode[] = this.buildContentUnitsWithNodes(children)
    const words: Array<{ word: string, isHerbDisable: boolean }> = []

    for (const { unit, node } of unitsWithNodes) {
      if (unit.breaksFlow) {
        this.flushWords(words)

        if (node) {
          this.visit(node)
        }
      } else if (unit.isAtomic) {
        words.push({ word: unit.content, isHerbDisable: unit.isHerbDisable || false })
      } else {
        const text = unit.content.replace(ASCII_WHITESPACE, ' ')
        const hasLeadingSpace = text.startsWith(' ')
        const hasTrailingSpace = text.endsWith(' ')
        const trimmedText = text.trim()

        if (trimmedText) {
          if (hasLeadingSpace && words.length > 0) {
            const lastWord = words[words.length - 1]

            if (!lastWord.word.endsWith(' ')) {
              lastWord.word += ' '
            }
          }

          const textWords = trimmedText.split(' ').map(w => ({ word: w, isHerbDisable: false }))
          words.push(...textWords)

          if (hasTrailingSpace && words.length > 0) {
            const lastWord = words[words.length - 1]

            if (!isClosingPunctuation(lastWord.word)) {
              lastWord.word += ' '
            }
          }
        } else if (text === ' ' && words.length > 0) {
          const lastWord = words[words.length - 1]

          if (!lastWord.word.endsWith(' ')) {
            lastWord.word += ' '
          }
        }
      }
    }

    this.flushWords(words)
  }

  /**
   * Try to merge text that follows an atomic unit (ERB/inline) with no whitespace
   * Returns true if merge was performed
   */
  private tryMergeTextAfterAtomic(result: ContentUnitWithNode[], textNode: HTMLTextNode): boolean {
    if (result.length === 0) return false

    const lastUnit = result[result.length - 1]

    if (!lastUnit.unit.isAtomic || (lastUnit.unit.type !== 'erb' && lastUnit.unit.type !== 'inline')) {
      return false
    }

    const words = normalizeAndSplitWords(textNode.content)
    if (words.length === 0 || !words[0]) return false

    const firstWord = words[0]
    const firstChar = firstWord[0]

    if (' \t\n\r'.includes(firstChar)) {
      return false
    }

    lastUnit.unit.content += firstWord

    if (words.length > 1) {
      let remainingText = words.slice(1).join(' ')

      if (endsWithWhitespace(textNode.content)) {
        remainingText += ' '
      }

      result.push({
        unit: { content: remainingText, type: 'text', isAtomic: false, breaksFlow: false },
        node: textNode
      })
    } else if (endsWithWhitespace(textNode.content)) {
      result.push({
        unit: { content: ' ', type: 'text', isAtomic: false, breaksFlow: false },
        node: textNode
      })
    }

    return true
  }

  /**
   * Try to merge an atomic unit (ERB/inline) with preceding text that has no whitespace
   * Returns true if merge was performed
   */
  private tryMergeAtomicAfterText(result: ContentUnitWithNode[], children: Node[], lastProcessedIndex: number, atomicContent: string, atomicType: 'erb' | 'inline', atomicNode: Node): boolean {
    if (result.length === 0) return false

    const lastUnit = result[result.length - 1]

    if (lastUnit.unit.type !== 'text' || lastUnit.unit.isAtomic) return false

    const words = normalizeAndSplitWords(lastUnit.unit.content)
    const lastWord = words[words.length - 1]

    if (!lastWord) return false

    result.pop()

    if (words.length > 1) {
      const remainingText = words.slice(0, -1).join(' ')

      result.push({
        unit: { content: remainingText, type: 'text', isAtomic: false, breaksFlow: false },
        node: children[lastProcessedIndex]
      })
    }

    result.push({
      unit: { content: lastWord + atomicContent, type: atomicType, isAtomic: true, breaksFlow: false },
      node: atomicNode
    })

    return true
  }

  /**
   * Check if there's whitespace between current node and last processed node
   */
  private hasWhitespaceBeforeNode(children: Node[], lastProcessedIndex: number, currentIndex: number, currentNode: Node): boolean {
    if (hasWhitespaceBetween(children, lastProcessedIndex, currentIndex)) {
      return true
    }

    if (isNode(currentNode, HTMLTextNode) && /^[ \t\n\r]/.test(currentNode.content)) {
      return true
    }

    return false
  }

  /**
   * Check if last unit in result ends with whitespace
   */
  private lastUnitEndsWithWhitespace(result: ContentUnitWithNode[]): boolean {
    if (result.length === 0) return false

    const lastUnit = result[result.length - 1]

    return lastUnit.unit.type === 'text' && endsWithWhitespace(lastUnit.unit.content)
  }

  /**
   * Process a text node and add it to results (with potential merging)
   */
  private processTextNode(result: ContentUnitWithNode[], children: Node[], child: HTMLTextNode, index: number, lastProcessedIndex: number): void {
    const isAtomic = child.content === ' '

    if (!isAtomic && lastProcessedIndex >= 0 && result.length > 0) {
      const hasWhitespace = this.hasWhitespaceBeforeNode(children, lastProcessedIndex, index, child)
      const lastUnit = result[result.length - 1]
      const lastIsAtomic = lastUnit.unit.isAtomic && (lastUnit.unit.type === 'erb' || lastUnit.unit.type === 'inline')

      if (lastIsAtomic && !hasWhitespace && this.tryMergeTextAfterAtomic(result, child)) {
        return
      }
    }

    result.push({
      unit: { content: child.content, type: 'text', isAtomic, breaksFlow: false },
      node: child
    })
  }

  /**
   * Process an inline element and add it to results (with potential merging)
   */
  private processInlineElement(result: ContentUnitWithNode[], children: Node[], child: HTMLElementNode, index: number, lastProcessedIndex: number): boolean {
    const tagName = getTagName(child)
    const childrenToRender = this.getFilteredChildren(child.body)
    const inlineContent = this.tryRenderInlineFull(child, tagName, filterNodes(getOpenTagChildren(child), HTMLAttributeNode), childrenToRender)

    if (inlineContent === null) {
      result.push({
        unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
        node: child
      })

      return false
    }

    if (lastProcessedIndex >= 0) {
      const hasWhitespace = hasWhitespaceBetween(children, lastProcessedIndex, index) || this.lastUnitEndsWithWhitespace(result)

      if (!hasWhitespace && this.tryMergeAtomicAfterText(result, children, lastProcessedIndex, inlineContent, 'inline', child)) {
        return true
      }
    }

    result.push({
      unit: { content: inlineContent, type: 'inline', isAtomic: true, breaksFlow: false },
      node: child
    })

    return false
  }

  /**
   * Process an ERB content node and add it to results (with potential merging)
   */
  private processERBContentNode(result: ContentUnitWithNode[], children: Node[], child: ERBContentNode, index: number, lastProcessedIndex: number): boolean {
    const erbContent = this.renderERBAsString(child)
    const isHerbDisable = isHerbDisableComment(child)

    if (lastProcessedIndex >= 0) {
      const hasWhitespace = hasWhitespaceBetween(children, lastProcessedIndex, index) || this.lastUnitEndsWithWhitespace(result)

      if (!hasWhitespace && this.tryMergeAtomicAfterText(result, children, lastProcessedIndex, erbContent, 'erb', child)) {
        return true
      }

      if (hasWhitespace && result.length > 0) {
        const lastUnit = result[result.length - 1]
        const lastIsAtomic = lastUnit.unit.isAtomic && (lastUnit.unit.type === 'inline' || lastUnit.unit.type === 'erb')

        if (lastIsAtomic && !this.lastUnitEndsWithWhitespace(result)) {
          result.push({
            unit: { content: ' ', type: 'text', isAtomic: true, breaksFlow: false },
            node: null
          })
        }
      }
    }

    result.push({
      unit: { content: erbContent, type: 'erb', isAtomic: true, breaksFlow: false, isHerbDisable },
      node: child
    })

    return false
  }

  /**
   * Convert AST nodes to content units with node references
   */
  private buildContentUnitsWithNodes(children: Node[]): ContentUnitWithNode[] {
    const result: ContentUnitWithNode[] = []
    let lastProcessedIndex = -1

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (isNode(child, WhitespaceNode)) continue

      if (isPureWhitespaceNode(child) && !(isNode(child, HTMLTextNode) && child.content === ' ')) {
        if (lastProcessedIndex >= 0) {
          const hasNonWhitespaceAfter = children.slice(i + 1).some(node =>
            !isNode(node, WhitespaceNode) && !isPureWhitespaceNode(node)
          )

          if (hasNonWhitespaceAfter) {
            const previousNode = children[lastProcessedIndex]

            if (!isLineBreakingElement(previousNode)) {
              result.push({
                unit: { content: ' ', type: 'text', isAtomic: true, breaksFlow: false },
                node: child
              })
            }
          }
        }

        continue
      }

      if (isNode(child, HTMLTextNode)) {
        this.processTextNode(result, children, child, i, lastProcessedIndex)

        lastProcessedIndex = i
      } else if (isNode(child, HTMLElementNode)) {
        const tagName = getTagName(child)

        if (isInlineElement(tagName)) {
          const merged = this.processInlineElement(result, children, child, i, lastProcessedIndex)

          if (merged) {
            lastProcessedIndex = i

            continue
          }
        } else {
          result.push({
            unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
            node: child
          })
        }

        lastProcessedIndex = i
      } else if (isNode(child, ERBContentNode)) {
        const merged = this.processERBContentNode(result, children, child, i, lastProcessedIndex)

        if (merged) {
          lastProcessedIndex = i

          continue
        }

        lastProcessedIndex = i
      } else {
        result.push({
          unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
          node: child
        })

        lastProcessedIndex = i
      }
    }

    return result
  }

  /**
   * Flush accumulated words to output with wrapping
   */
  private flushWords(words: Array<{ word: string, isHerbDisable: boolean }>): void {
    if (words.length > 0) {
      this.wrapAndPushWords(words)
      words.length = 0
    }
  }

  /**
   * Wrap words to fit within line length and push to output
   * Handles punctuation spacing intelligently
   * Excludes herb:disable comments from line length calculations
   */
  private wrapAndPushWords(words: Array<{ word: string, isHerbDisable: boolean }>): void {
    const wrapWidth = this.maxLineLength - this.indent.length
    const lines: string[] = []
    let currentLine = ""
    let effectiveLength = 0

    for (const { word, isHerbDisable } of words) {
      const nextLine = buildLineWithWord(currentLine, word)

      let nextEffectiveLength = effectiveLength

      if (!isHerbDisable) {
        const spaceBefore = currentLine && needsSpaceBetween(currentLine, word) ? 1 : 0
        nextEffectiveLength = effectiveLength + spaceBefore + word.length
      }

      if (currentLine && !isClosingPunctuation(word) && nextEffectiveLength >= wrapWidth) {
        lines.push(this.indent + currentLine.trimEnd())

        currentLine = word
        effectiveLength = isHerbDisable ? 0 : word.length
      } else {
        currentLine = nextLine
        effectiveLength = nextEffectiveLength
      }
    }

    if (currentLine) {
      lines.push(this.indent + currentLine.trimEnd())
    }

    lines.forEach(line => this.push(line))
  }

  private isInTextFlowContext(_parent: Node | null, children: Node[]): boolean {
    const hasTextContent = children.some(child => isNode(child, HTMLTextNode) &&child.content.trim() !== "")
    const nonTextChildren = children.filter(child => !isNode(child, HTMLTextNode))

    if (!hasTextContent) return false
    if (nonTextChildren.length === 0) return false

    const allInline = nonTextChildren.every(child => {
      if (isNode(child, ERBContentNode)) return true

      if (isNode(child, HTMLElementNode)) {
        return isInlineElement(getTagName(child))
      }

      return false
    })

    if (!allInline) return false

    return true
  }

  private renderInlineOpen(name: string, attributes: HTMLAttributeNode[], selfClose: boolean, inlineNodes: Node[] = [], allChildren: Node[] = []): string {
    const parts = attributes.map(attribute => this.renderAttribute(attribute))

    if (inlineNodes.length > 0) {
      let result = `<${name}`

      if (allChildren.length > 0) {
        const lines = this.capture(() => {
          allChildren.forEach(child => {
            if (isNode(child, HTMLAttributeNode)) {
              this.lines.push(" " + this.renderAttribute(child))
            } else if (!(isNode(child, WhitespaceNode))) {
              const wasInlineMode = this.inlineMode

              this.inlineMode = true

              this.lines.push(" ")
              this.visit(child)
              this.inlineMode = wasInlineMode
            }
          })
        })

        result += lines.join("")
      } else {
        if (parts.length > 0) {
          result += ` ${parts.join(" ")}`
        }

        const lines = this.capture(() => {
          inlineNodes.forEach(node => {
            const wasInlineMode = this.inlineMode

            if (!isERBControlFlowNode(node)) {
              this.inlineMode = true
            }

            this.visit(node)

            this.inlineMode = wasInlineMode
          })
        })

        result += lines.join("")
      }

      result += selfClose ? " />" : ">"

      return result
    }

    return `<${name}${parts.length ? " " + parts.join(" ") : ""}${selfClose ? " />" : ">"}`
  }

  renderAttribute(attribute: HTMLAttributeNode): string {
    const name = attribute.name ? getCombinedAttributeName(attribute.name) : ""
    const equals = attribute.equals?.value ?? ""

    this.currentAttributeName = name

    let value = ""

    if (isNode(attribute.value, HTMLAttributeValueNode)) {
      const attributeValue = attribute.value

      let open_quote = attributeValue.open_quote?.value ?? ""
      let close_quote = attributeValue.close_quote?.value ?? ""
      let htmlTextContent = ""

      const content = attributeValue.children.map((child: Node) => {
        if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
          htmlTextContent += child.content

          return child.content
        } else if (isNode(child, ERBContentNode)) {
          return this.reconstructERBNode(child, true)
        } else {
          const printed = IdentityPrinter.print(child)

          if (this.isInTokenListAttribute) {
            return printed.replace(/%>([^<\s])/g, '%> $1').replace(/([^>\s])<%/g, '$1 <%')
          }

          return printed
        }
      }).join("")

      if (open_quote === "" && close_quote === "") {
        open_quote = '"'
        close_quote = '"'
      } else if (open_quote === "'" && close_quote === "'" && !htmlTextContent.includes('"')) {
        open_quote = '"'
        close_quote = '"'
      }

      if (this.isFormattableAttribute(name, this.currentTagName)) {
        if (name === 'class') {
          value = this.formatClassAttribute(content, name, equals, open_quote, close_quote)
        } else {
          value = this.formatMultilineAttribute(content, name, open_quote, close_quote)
        }
      } else {
        value = open_quote + content + close_quote
      }
    }

    this.currentAttributeName = null

    return name + equals + value
  }

  /**
   * Try to render a complete element inline including opening tag, children, and closing tag
   */
  private tryRenderInlineFull(_node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], children: Node[]): string | null {
    let result = `<${tagName}`

    result += this.renderAttributesString(attributes)
    result += ">"

    const childrenContent = this.tryRenderChildrenInline(children, tagName)

    if (!childrenContent) return null

    result += childrenContent
    result += `</${tagName}>`

    return result
  }

  /**
   * Check if children contain a leading herb:disable comment (after optional whitespace)
   */
  private hasLeadingHerbDisable(children: Node[]): boolean {
    for (const child of children) {
      if (isNode(child, WhitespaceNode) || (isNode(child, HTMLTextNode) && child.content.trim() === "")) {
        continue
      }

      return isNode(child, ERBContentNode) && isHerbDisableComment(child)
    }

    return false
  }

  /**
   * Try to render just the children inline (without tags)
   */
  private tryRenderChildrenInline(children: Node[], tagName?: string): string | null {
    let result = ""
    let hasInternalWhitespace = false
    let addedLeadingSpace = false

    const hasHerbDisable = this.hasLeadingHerbDisable(children)
    const hasOnlyTextContent = children.every(child => isNode(child, HTMLTextNode) || isNode(child, WhitespaceNode))
    const shouldPreserveSpaces = hasOnlyTextContent && tagName && isInlineElement(tagName)

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        const normalizedContent = child.content.replace(ASCII_WHITESPACE, ' ')
        const hasLeadingSpace = /^[ \t\n\r]/.test(child.content)
        const hasTrailingSpace = /[ \t\n\r]$/.test(child.content)
        const trimmedContent = normalizedContent.trim()

        if (trimmedContent) {
          if (hasLeadingSpace && (result || shouldPreserveSpaces) && !result.endsWith(' ')) {
            result += ' '
          }

          result += trimmedContent

          if (hasTrailingSpace) {
            result += ' '
          }

          continue
        }
      }

      const isWhitespace = isNode(child, WhitespaceNode) || (isNode(child, HTMLTextNode) && child.content.trim() === "")

      if (isWhitespace && !result.endsWith(' ')) {
        if (!result && hasHerbDisable && !addedLeadingSpace) {
          result += ' '
          addedLeadingSpace = true
        } else if (result) {
          result += ' '
          hasInternalWhitespace = true
        }
      } else if (isNode(child, HTMLElementNode)) {
        const tagName = getTagName(child)

        if (!isInlineElement(tagName)) {
          return null
        }

        const childrenToRender = this.getFilteredChildren(child.body)
        const childInline = this.tryRenderInlineFull(child, tagName,
          filterNodes(getOpenTagChildren(child), HTMLAttributeNode),
          childrenToRender
        )

        if (!childInline) {
          return null
        }

        result += childInline
      } else if (!isNode(child, HTMLTextNode) && !isWhitespace) {
        const wasInlineMode = this.inlineMode
        this.inlineMode = true
        const captured = this.capture(() => this.visit(child)).join("")
        this.inlineMode = wasInlineMode
        result += captured
      }
    }

    if (shouldPreserveSpaces) {
      return result
    }

    if (hasHerbDisable && result.startsWith(' ') || hasInternalWhitespace) {
      return result.trimEnd()
    }

    return result.trim()
  }

  /**
   * Try to render children inline if they are simple enough.
   * Returns the inline string if possible, null otherwise.
   */
  private tryRenderInline(children: Node[], tagName: string): string | null {
    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        if (child.content.includes('\n')) {
          return null
        }
      } else if (isNode(child, HTMLElementNode)) {
        if (!isInlineElement(getTagName(child))) {
          return null
        }
      } else if (isNode(child, ERBContentNode)) {
        // ERB content nodes are allowed in inline rendering
      } else {
        return null
      }
    }

    let content = ""

    this.capture(() => {
      content = this.renderChildrenInline(children)
    })

    return `<${tagName}>${content}</${tagName}>`
  }

  /**
   * Get filtered children, using smart herb:disable filtering if needed
   */
  private getFilteredChildren(body: Node[]): Node[] {
    const hasHerbDisable = body.some(child =>
      isNode(child, ERBContentNode) && isHerbDisableComment(child)
    )

    return hasHerbDisable ? filterEmptyNodesForHerbDisable(body) : body
  }

  private renderElementInline(element: HTMLElementNode): string {
    const children = this.getFilteredChildren(element.body)

    return this.renderChildrenInline(children)
  }

  private renderChildrenInline(children: Node[]) {
    let content = ''

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        content += child.content
      } else if (isNode(child, HTMLElementNode)) {
        const tagName = getTagName(child)
        const attributes = filterNodes(getOpenTagChildren(child), HTMLAttributeNode)
        const attributesString = this.renderAttributesString(attributes)
        const childContent = this.renderElementInline(child)

        content += `<${tagName}${attributesString}>${childContent}</${tagName}>`
      } else if (isNode(child, ERBContentNode)) {
        content += this.reconstructERBNode(child, true)
      }
    }

    return content.replace(ASCII_WHITESPACE, ' ').trim()
  }
}
