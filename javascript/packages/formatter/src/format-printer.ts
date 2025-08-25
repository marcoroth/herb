import dedent from "dedent"
import {
  getTagName,
  getCombinedAttributeName,
  getCombinedStringFromNodes,
  isNode,
  isToken,
  isParseResult,
  isAnyOf,
  isNoneOf,
  isERBNode,
  isCommentNode,
  isERBControlFlowNode,
  filterNodes,
  hasERBOutput,
} from "@herb-tools/core"
import { Printer, IdentityPrinter } from "@herb-tools/printer"

import {
  ParseResult,
  Node,
  DocumentNode,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLElementNode,
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
 * Analysis result for HTMLElementNode formatting decisions
 */
interface ElementFormattingAnalysis {
  openTagInline: boolean
  elementContentInline: boolean
  closeTagInline: boolean
}

// TODO: we can probably expand this list with more tags/attributes
const FORMATTABLE_ATTRIBUTES: Record<string, string[]> = {
  '*': ['class'],
  'img': ['srcset', 'sizes']
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
  private currentAttributeName: string | null = null
  private elementStack: HTMLElementNode[] = []
  private elementFormattingAnalysis = new Map<HTMLElementNode, ElementFormattingAnalysis>()

  public source: string

  // TODO: extract
  private static readonly INLINE_ELEMENTS = new Set([
    'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'br', 'cite', 'code',
    'dfn', 'em', 'i', 'img', 'kbd', 'label', 'map', 'object', 'q',
    'samp', 'small', 'span', 'strong', 'sub', 'sup',
    'tt', 'var', 'del', 'ins', 'mark', 's', 'u', 'time', 'wbr'
  ])

  private static readonly CONTENT_PRESERVING_ELEMENTS = new Set([
    'script', 'style', 'pre', 'textarea'
  ])

  private static readonly SPACEABLE_CONTAINERS = new Set([
    'div', 'section', 'article', 'main', 'header', 'footer', 'aside',
    'figure', 'details', 'summary', 'dialog', 'fieldset'
  ])

  private static readonly TIGHT_GROUP_PARENTS = new Set([
    'ul', 'ol', 'nav', 'select', 'datalist', 'optgroup', 'tr', 'thead',
    'tbody', 'tfoot'
  ])

  private static readonly TIGHT_GROUP_CHILDREN = new Set([
    'li', 'option', 'td', 'th', 'dt', 'dd'
  ])

  private static readonly SPACING_THRESHOLD = 3

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
    return this.currentElement?.open_tag?.tag_name?.value ?? ""
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

    this.lines = []

    try {
      callback()

      return this.lines
    } finally {
      this.lines = previousLines
      this.inlineMode = previousInlineMode
    }
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
   * Returns empty string if content is empty, otherwise wraps content with single spaces.
   */
  private formatERBContent(content: string): string {
    return content.trim() ? ` ${content.trim()} ` : ""
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
  private shouldAddSpacingBetweenSiblings(
    parentElement: HTMLElementNode | null,
    siblings: Node[],
    currentIndex: number,
    hasExistingSpacing: boolean
  ): boolean {
    if (hasExistingSpacing) {
      return true
    }

    const hasMixedContent = siblings.some(child => isNode(child, HTMLTextNode) && child.content.trim() !== "")

    if (hasMixedContent) {
      return false
    }

    const meaningfulSiblings = siblings.filter(child => this.isNonWhitespaceNode(child))

    if (meaningfulSiblings.length < FormatPrinter.SPACING_THRESHOLD) {
      return false
    }

    const parentTagName = parentElement ? getTagName(parentElement) : null

    if (parentTagName && FormatPrinter.TIGHT_GROUP_PARENTS.has(parentTagName)) {
      return false
    }

    const isSpaceableContainer = !parentTagName || (parentTagName && FormatPrinter.SPACEABLE_CONTAINERS.has(parentTagName))

    if (!isSpaceableContainer && meaningfulSiblings.length < 5) {
      return false
    }

    const currentNode = siblings[currentIndex]
    const previousMeaningfulIndex = this.findPreviousMeaningfulSibling(siblings, currentIndex)
    const isCurrentComment = isCommentNode(currentNode)

    if (previousMeaningfulIndex !== -1) {
      const previousNode = siblings[previousMeaningfulIndex]
      const isPreviousComment = isCommentNode(previousNode)

      if (isPreviousComment && !isCurrentComment && (isNode(currentNode, HTMLElementNode) || isERBNode(currentNode))) {
        return false
      }

      if (isPreviousComment && isCurrentComment) {
        return false
      }
    }

    if (isNode(currentNode, HTMLElementNode)) {
      const currentTagName = getTagName(currentNode)

      if (FormatPrinter.INLINE_ELEMENTS.has(currentTagName)) {
        return false
      }

      if (FormatPrinter.TIGHT_GROUP_CHILDREN.has(currentTagName)) {
        return false
      }

      if (currentTagName === 'a' && parentTagName === 'nav') {
        return false
      }
    }

    const isBlockElement = this.isBlockLevelNode(currentNode)
    const isERBBlock = isERBNode(currentNode) && isERBControlFlowNode(currentNode)
    const isComment = isCommentNode(currentNode)

    return isBlockElement || isERBBlock || isComment
  }

  /**
   * Token list attributes that contain space-separated values and benefit from
   * spacing around ERB content for readability
   */
  private static readonly TOKEN_LIST_ATTRIBUTES = new Set([
    'class', 'data-controller', 'data-action'
  ])

  /**
   * Check if we're currently processing a token list attribute that needs spacing
   */
  private isInTokenListAttribute(): boolean {
    return this.currentAttributeName !== null &&
           FormatPrinter.TOKEN_LIST_ATTRIBUTES.has(this.currentAttributeName)
  }

  /**
   * Find the previous meaningful (non-whitespace) sibling
   */
  private findPreviousMeaningfulSibling(siblings: Node[], currentIndex: number): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (this.isNonWhitespaceNode(siblings[i])) {
        return i
      }
    }
    return -1
  }

  /**
   * Check if a node represents a block-level element
   */
  private isBlockLevelNode(node: Node): boolean {
    if (!isNode(node, HTMLElementNode)) {
      return false
    }

    const tagName = getTagName(node)

    if (FormatPrinter.INLINE_ELEMENTS.has(tagName)) {
      return false
    }

    return true
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

  private getAttributeName(attribute: HTMLAttributeNode): string {
    return attribute.name ? getCombinedAttributeName(attribute.name) : ""
  }

  private wouldClassAttributeBeMultiline(content: string, indentLength: number): boolean {
    const normalizedContent = content.replace(/\s+/g, ' ').trim()
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
            const normalizedContent = content.replace(/\s+/g, ' ').trim()

            return normalizedContent.length > 80
          }

          const lines = content.split(/\r?\n/)

          if (lines.length > 1) {
            return lines.slice(1).some(line => /^\s+/.test(line))
          }
        }
      }

      return false
    })
  }

  private formatClassAttribute(content: string, name: string, equals: string, open_quote: string, close_quote: string): string {
    const normalizedContent = content.replace(/\s+/g, ' ').trim()
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
      const normalizedContent = content.replace(/\s+/g, ' ').trim()

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
    this.pushWithIndent(`<${tagName}`)

    this.withIndent(() => {
      allChildren.forEach(child => {
        if (isNode(child, HTMLAttributeNode)) {
          this.pushWithIndent(this.renderAttribute(child))
        } else if (!isNode(child, WhitespaceNode)) {
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
    let lastWasMeaningful = false
    let hasHandledSpacing = false

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]

      if (isNode(child, HTMLTextNode)) {
        const isWhitespaceOnly = child.content.trim() === ""

        if (isWhitespaceOnly) {
          const hasPreviousNonWhitespace = i > 0 && this.isNonWhitespaceNode(node.children[i - 1])
          const hasNextNonWhitespace = i < node.children.length - 1 && this.isNonWhitespaceNode(node.children[i + 1])

          const hasMultipleNewlines = child.content.includes('\n\n')

          if (hasPreviousNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
            this.push("")
            hasHandledSpacing = true
          }

          continue
        }
      }

      if (this.isNonWhitespaceNode(child) && lastWasMeaningful && !hasHandledSpacing) {
        this.push("")
      }

      this.visit(child)

      if (this.isNonWhitespaceNode(child)) {
        lastWasMeaningful = true
        hasHandledSpacing = false
      }
    }
  }

  visitHTMLElementNode(node: HTMLElementNode) {
    this.elementStack.push(node)
    this.elementFormattingAnalysis.set(node, this.analyzeElementFormatting(node))

    this.visit(node.open_tag)

    if (node.body.length > 0) {
      this.visitHTMLElementBody(node.body, node)
    }

    if (node.close_tag) {
      this.visit(node.close_tag)
    }

    this.elementStack.pop()
  }

  visitHTMLElementBody(body: Node[], element: HTMLElementNode) {
    if (this.isContentPreserving(element)) {
      element.body.map(child => this.pushToLastLine(IdentityPrinter.print(child)))

      return
    }

    const analysis = this.elementFormattingAnalysis.get(element)
    const hasTextFlow = this.isInTextFlowContext(null, body)
    const children = this.filterSignificantChildren(body, hasTextFlow)

    if (analysis?.elementContentInline) {
      if (children.length === 0) return

      const oldInlineMode = this.inlineMode
      const nodesToRender = hasTextFlow ? body : children

      this.inlineMode = true

      const lines = this.capture(() => {
        nodesToRender.forEach(child => {
          if (isNode(child, HTMLTextNode)) {
            if (hasTextFlow) {
              const normalizedContent = child.content.replace(/\s+/g, ' ')

              if (normalizedContent && normalizedContent !== ' ') {
                this.push(normalizedContent)
              } else if (normalizedContent === ' ') {
                this.push(' ')
              }
            } else {
              const normalizedContent = child.content.replace(/\s+/g, ' ').trim()

              if (normalizedContent) {
                this.push(normalizedContent)
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
      const inlineContent = hasTextFlow ? content.replace(/\s+/g, ' ').trim() : content.trim()

      if (inlineContent) {
        this.pushToLastLine(inlineContent)
      }

      this.inlineMode = oldInlineMode

      return
    }

    if (children.length === 0) return

    this.withIndent(() => {
      if (hasTextFlow) {
        this.visitTextFlowChildren(children)
      } else {
        this.visitElementChildren(body, element)
      }
    })
  }

  /**
   * Visit element children with intelligent spacing logic
   */
  private visitElementChildren(body: Node[], parentElement: HTMLElementNode | null) {
    let lastWasMeaningful = false
    let hasHandledSpacing = false

    for (let i = 0; i < body.length; i++) {
      const child = body[i]

      if (isNode(child, HTMLTextNode)) {
        const isWhitespaceOnly = child.content.trim() === ""

        if (isWhitespaceOnly) {
          const hasPreviousNonWhitespace = i > 0 && this.isNonWhitespaceNode(body[i - 1])
          const hasNextNonWhitespace = i < body.length - 1 && this.isNonWhitespaceNode(body[i + 1])

          const hasMultipleNewlines = child.content.includes('\n\n')

          if (hasPreviousNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
            this.push("")
            hasHandledSpacing = true
          }

          continue
        }
      }

      if (this.isNonWhitespaceNode(child) && lastWasMeaningful && !hasHandledSpacing) {
        const element = body[i - 1]
        const hasExistingSpacing = i > 0 && isNode(element, HTMLTextNode) && element.content.trim() === "" && (element.content.includes('\n\n') || element.content.split('\n').length > 2)

        const shouldAddSpacing = this.shouldAddSpacingBetweenSiblings(
          parentElement,
          body,
          i,
          hasExistingSpacing
        )

        if (shouldAddSpacing) {
          this.push("")
        }
      }

      this.visit(child)

      if (this.isNonWhitespaceNode(child)) {
        lastWasMeaningful = true
        hasHandledSpacing = false
      }
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode) {
    const attributes = filterNodes(node.children, HTMLAttributeNode)
    const inlineNodes = this.extractInlineNodes(node.children)
    const isSelfClosing = node.tag_closing?.value === "/>"

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
      const normalizedContent = node.content.replace(/\s+/g, ' ').trim()

      if (normalizedContent) {
        this.push(normalizedContent)
      }

      return
    }

    let text = node.content.trim()

    if (!text) return

    const wrapWidth = this.maxLineLength - this.indent.length
    const words = text.split(/\s+/)
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
        if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
          return child.content
        } else if (isERBNode(child) || isNode(child, ERBContentNode)) {
          return this.reconstructERBNode(child, false)
        } else {
          return ""
        }
      }).join("")

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

      this.pushWithIndent(open + before + content.trimEnd() + ' ' + close)

      return
    }

    if (contentTrimmedLines.length === 1) {
      this.pushWithIndent(open + ' ' + content.trim() + ' ' + close)
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
    // TODO: this feels hacky
    if (node.tag_opening?.value === "<%#") {
      this.visitERBCommentNode(node)
    } else {
      this.printERBNode(node)
    }
  }

  visitERBEndNode(node: ERBEndNode) {
    this.printERBNode(node)
  }

  visitERBYieldNode(node: ERBYieldNode) {
    this.printERBNode(node)
  }

  visitERBInNode(node: ERBInNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode) {
    this.printERBNode(node)
    this.visitAll(node.conditions)

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBBlockNode(node: ERBBlockNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitElementChildren(node.body, null))

    if (node.end_node) this.visit(node.end_node)
  }

  visitERBIfNode(node: ERBIfNode) {
    if (this.inlineMode) {
      this.printERBNode(node)

      node.statements.forEach(child => {
        if (isNode(child, HTMLAttributeNode)) {
          this.lines.push(" ")
          this.lines.push(this.renderAttribute(child))
        } else {
          const shouldAddSpaces = this.isInTokenListAttribute()

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
      const isTokenList = this.isInTokenListAttribute()

      if ((hasHTMLAttributes || isTokenList) && node.end_node) {
        this.lines.push(" ")
      }

      if (node.subsequent) this.visit(node.end_node)
      if (node.end_node) this.visit(node.end_node)
    } else {
      this.printERBNode(node)

      this.withIndent(() => {
        node.statements.forEach(child => this.visit(child))
      })

      if (node.subsequent) this.visit(node.subsequent)
      if (node.end_node) this.visit(node.end_node)
    }
  }

  visitERBElseNode(node: ERBElseNode) {
    this.printERBNode(node)
    this.withIndent(() => node.statements.forEach(statement => this.visit(statement)))
  }

  visitERBWhenNode(node: ERBWhenNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))
  }

  visitERBCaseNode(node: ERBCaseNode) {
    this.printERBNode(node)
    this.visitAll(node.conditions)

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBBeginNode(node: ERBBeginNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))

    if (node.rescue_clause) this.visit(node.rescue_clause)
    if (node.else_clause) this.visit(node.else_clause)
    if (node.ensure_clause) this.visit(node.ensure_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBWhileNode(node: ERBWhileNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))

    if (node.end_node) this.visit(node.end_node)
  }

  visitERBUntilNode(node: ERBUntilNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))

    if (node.end_node) this.visit(node.end_node)
  }

  visitERBForNode(node: ERBForNode) {
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))

    if (node.end_node) this.visit(node.end_node)
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
    this.printERBNode(node)
    this.withIndent(() => this.visitAll(node.statements))

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
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
    const children = node.open_tag?.children || []
    const attributes = filterNodes(children, HTMLAttributeNode)
    const inlineNodes = this.extractInlineNodes(children)
    const hasERBControlFlow = inlineNodes.some(node => isERBControlFlowNode(node)) || children.some(node => isERBControlFlowNode(node))
    const hasComplexERB = hasERBControlFlow && this.hasComplexERBControlFlow(inlineNodes)

    if (hasComplexERB) return false

    const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)
    const hasMultilineAttrs = this.hasMultilineAttributes(attributes)

    if (hasMultilineAttrs) return false

    const inline = this.renderInlineOpen(
      getTagName(node),
      attributes,
      node.open_tag?.tag_closing?.value === "/>",
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
    const children = this.filterSignificantChildren(node.body, this.isInTextFlowContext(null, node.body))
    const isInlineElement = this.isInlineElement(tagName)
    const openTagInline = this.shouldRenderOpenTagInline(node)

    if (!openTagInline) return false
    if (children.length === 0) return true

    if (isInlineElement) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(node.open_tag?.children, HTMLAttributeNode), children)

      if (fullInlineResult) {
        const totalLength = this.indent.length + fullInlineResult.length
        return totalLength <= this.maxLineLength || totalLength <= 120
      }

      return false
    }

    const allNestedAreInline = this.areAllNestedElementsInline(children)
    const hasMultilineText = this.hasMultilineTextContent(children)
    const hasMixedContent = this.hasMixedTextAndInlineContent(children)

    if (allNestedAreInline && (!hasMultilineText || hasMixedContent)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(node.open_tag?.children, HTMLAttributeNode), children)

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
        filterNodes(node.open_tag?.children, HTMLAttributeNode),
        false,
        [],
        node.open_tag?.children || []
      )

      const childrenContent = this.renderChildrenInline(children)
      const fullLine = openTagResult + childrenContent + `</${tagName}>`

      if ((this.indent.length + fullLine.length) <= this.maxLineLength) {
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
    if (node.open_tag?.tag_closing?.value === "/>") return true
    if (this.isContentPreserving(node)) return true

    const children = this.filterSignificantChildren(node.body, this.isInTextFlowContext(null, node.body))

    if (children.length === 0) return true

    return elementContentInline
  }


  // --- Utility methods ---

  private isNonWhitespaceNode(node: Node): boolean {
    if (isNode(node, WhitespaceNode)) return false
    if (isNode(node, HTMLTextNode)) return node.content.trim() !== ""

    return true
  }

  /**
   * Check if an element should be treated as inline based on its tag name
   */
  private isInlineElement(tagName: string): boolean {
    return FormatPrinter.INLINE_ELEMENTS.has(tagName.toLowerCase())
  }

  /**
   * Check if we're in a text flow context (parent contains mixed text and inline elements)
   */
  private visitTextFlowChildren(children: Node[]) {
    let currentLineContent = ""

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        const content = child.content

        let processedContent = content.replace(/\s+/g, ' ').trim()

        if (processedContent) {
          const hasLeadingSpace = /^\s/.test(content)

          if (currentLineContent && hasLeadingSpace && !currentLineContent.endsWith(' ')) {
            currentLineContent += ' '
          }

          currentLineContent += processedContent

          const hasTrailingSpace = /\s$/.test(content)

          if (hasTrailingSpace && !currentLineContent.endsWith(' ')) {
            currentLineContent += ' '
          }

          if ((this.indent.length + currentLineContent.length) > Math.max(this.maxLineLength, 120)) {
            children.forEach(child => this.visit(child))

            return
          }
        }
      } else if (isNode(child, HTMLElementNode)) {
        const childTagName = getTagName(child)

        if (this.isInlineElement(childTagName)) {
          const childInline = this.tryRenderInlineFull(child, childTagName,
            filterNodes(child.open_tag?.children, HTMLAttributeNode),
            this.filterEmptyNodes(child.body)
          )

          if (childInline) {
            currentLineContent += childInline

            if ((this.indent.length + currentLineContent.length) > this.maxLineLength) {
              children.forEach(child => this.visit(child))

              return
            }
          } else {
            if (currentLineContent.trim()) {
              this.pushWithIndent(currentLineContent.trim())
              currentLineContent = ""
            }

            this.visit(child)
          }
        } else {
          if (currentLineContent.trim()) {
            this.pushWithIndent(currentLineContent.trim())
            currentLineContent = ""
          }

          this.visit(child)
        }
      } else if (isNode(child, ERBContentNode)) {
        const oldLines = this.lines
        const oldInlineMode = this.inlineMode

        // TODO: use this.capture
        try {
          this.lines = []
          this.inlineMode = true
          this.visit(child)
          const erbContent = this.lines.join("")
          currentLineContent += erbContent

          if ((this.indent.length + currentLineContent.length) > Math.max(this.maxLineLength, 120)) {
            this.lines = oldLines
            this.inlineMode = oldInlineMode
            children.forEach(child => this.visit(child))

            return
          }
        } finally {
          this.lines = oldLines
          this.inlineMode = oldInlineMode
        }
      } else {
        if (currentLineContent.trim()) {
          this.pushWithIndent(currentLineContent.trim())
          currentLineContent = ""
        }

        this.visit(child)
      }
    }

    if (currentLineContent.trim()) {
      const finalLine = this.indent + currentLineContent.trim()

      if (finalLine.length > Math.max(this.maxLineLength, 120)) {
        this.visitAll(children)

        return
      }

      this.push(finalLine)
    }
  }

  private isInTextFlowContext(_parent: Node | null, children: Node[]): boolean {
    const hasTextContent = children.some(child => isNode(child, HTMLTextNode) &&child.content.trim() !== "")
    const nonTextChildren = children.filter(child => !isNode(child, HTMLTextNode))

    if (!hasTextContent) return false
    if (nonTextChildren.length === 0) return false

    const allInline = nonTextChildren.every(child => {
      if (isNode(child, ERBContentNode)) return true

      if (isNode(child, HTMLElementNode)) {
        return this.isInlineElement(getTagName(child))
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
        if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
          htmlTextContent += child.content

          return child.content
        } else if (isNode(child, ERBContentNode)) {
          return IdentityPrinter.print(child)
        } else {
          const printed = IdentityPrinter.print(child)

          if (this.currentAttributeName && FormatPrinter.TOKEN_LIST_ATTRIBUTES.has(this.currentAttributeName)) {
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

    const childrenContent = this.tryRenderChildrenInline(children)

    if (!childrenContent) return null

    result += childrenContent
    result += `</${tagName}>`

    return result
  }

  /**
   * Try to render just the children inline (without tags)
   */
  private tryRenderChildrenInline(children: Node[]): string | null {
    let result = ""

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        const normalizedContent = child.content.replace(/\s+/g, ' ')
        const hasLeadingSpace = /^\s/.test(child.content)
        const hasTrailingSpace = /\s$/.test(child.content)
        const trimmedContent = normalizedContent.trim()

        if (trimmedContent) {
          let finalContent = trimmedContent

          if (hasLeadingSpace && result && !result.endsWith(' ')) {
            finalContent = ' ' + finalContent
          }

          if (hasTrailingSpace) {
            finalContent = finalContent + ' '
          }

          result += finalContent
        } else if (hasLeadingSpace || hasTrailingSpace) {
          if (result && !result.endsWith(' ')) {
            result += ' '
          }
        }

      } else if (isNode(child, HTMLElementNode)) {
        const tagName = getTagName(child)

        if (!this.isInlineElement(tagName)) {
          return null
        }

        const childInline = this.tryRenderInlineFull(child, tagName,
          filterNodes(child.open_tag?.children, HTMLAttributeNode),
          this.filterEmptyNodes(child.body)
        )

        if (!childInline) {
          return null
        }

        result += childInline
      } else {
        result += this.capture(() => this.visit(child)).join("")
      }
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
        const isInlineElement = this.isInlineElement(getTagName(child))

        if (!isInlineElement) {
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
   * Check if children contain mixed text and inline elements (like "text<em>inline</em>text")
   * or mixed ERB output and text (like "<%= value %> text")
   * This indicates content that should be formatted inline even with structural newlines
   */
  private hasMixedTextAndInlineContent(children: Node[]): boolean {
    let hasText = false
    let hasInlineElements = false

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        if (child.content.trim() !== "") {
          hasText = true
        }
      } else if (isNode(child, HTMLElementNode)) {
        if (this.isInlineElement(getTagName(child))) {
          hasInlineElements = true
        }
      }
    }

    return (hasText && hasInlineElements) || (hasERBOutput(children) && hasText)
  }

  /**
   * Check if children contain any text content with newlines
   */
  private hasMultilineTextContent(children: Node[]): boolean {
    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        return child.content.includes('\n')
      }

      if (isNode(child, HTMLElementNode)) {
        const nestedChildren = this.filterEmptyNodes(child.body)

        if (this.hasMultilineTextContent(nestedChildren)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if all nested elements in the children are inline elements
   */
  private areAllNestedElementsInline(children: Node[]): boolean {
    for (const child of children) {
      if (isNode(child, HTMLElementNode)) {
        if (!this.isInlineElement(getTagName(child))) {
          return false
        }

        const nestedChildren = this.filterEmptyNodes(child.body)

        if (!this.areAllNestedElementsInline(nestedChildren)) {
          return false
        }
      } else if (isAnyOf(child, HTMLDoctypeNode, HTMLCommentNode, isERBControlFlowNode)) {
        return false
      }
    }

    return true
  }

  /**
   * Check if element has complex ERB control flow
   */
  private hasComplexERBControlFlow(inlineNodes: Node[]): boolean {
    return inlineNodes.some(node => {
      if (isNode(node, ERBIfNode)) {
        if (node.statements.length > 0 && node.location) {
          const startLine = node.location.start.line
          const endLine = node.location.end.line

          return startLine !== endLine
        }

        return false
      }

      return false
    })
  }

  /**
   * Filter children to remove insignificant whitespace
   */
  private filterSignificantChildren(body: Node[], hasTextFlow: boolean): Node[] {
    return body.filter(child => {
      if (isNode(child, WhitespaceNode)) return false

      if (isNode(child, HTMLTextNode)) {
        if (hasTextFlow && child.content === " ") return true

        return child.content.trim() !== ""
      }

      return true
    })
  }

  /**
   * Filter out empty text nodes and whitespace nodes
   */
  private filterEmptyNodes(nodes: Node[]): Node[] {
    return nodes.filter(child =>
      !isNode(child, WhitespaceNode) && !(isNode(child, HTMLTextNode) && child.content.trim() === "")
    )
  }

  private renderElementInline(element: HTMLElementNode): string {
    const children = this.filterEmptyNodes(element.body)

    return this.renderChildrenInline(children)
  }

  private renderChildrenInline(children: Node[]) {
    let content = ''

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        content += child.content
      } else if (isNode(child, HTMLElementNode) ) {
        const tagName = getTagName(child)
        const attributes = filterNodes(child.open_tag?.children, HTMLAttributeNode)
        const attributesString = this.renderAttributesString(attributes)
        const childContent = this.renderElementInline(child)

        content += `<${tagName}${attributesString}>${childContent}</${tagName}>`
      } else if (isNode(child, ERBContentNode)) {
        content += this.reconstructERBNode(child, true)
      }
    }

    return content.replace(/\s+/g, ' ').trim()
  }

  private isContentPreserving(element: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode): boolean {
    const tagName = getTagName(element)

    return FormatPrinter.CONTENT_PRESERVING_ELEMENTS.has(tagName)
  }
}
