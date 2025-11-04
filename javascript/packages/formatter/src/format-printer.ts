import dedent from "dedent"

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
  filterNodes,
} from "@herb-tools/core"

import { Printer, IdentityPrinter } from "@herb-tools/printer"

import {
  areAllNestedElementsInline,
  buildLineWithWord,
  countAdjacentInlineElements,
  endsWithAlphanumeric,
  endsWithWhitespace,
  filterEmptyNodes,
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
  isHerbDisableComment,
  isInlineElement,
  isNonWhitespaceNode,
  isPureWhitespaceNode,
  needsSpaceBetween,
  normalizeAndSplitWords,
  shouldAppendToLastLine,
  shouldPreserveUserSpacing,
  shouldWrapToNextLine,
  startsWithAlphanumeric,
} from "./format-helpers.js"

import {
  FORMATTABLE_ATTRIBUTES,
  INLINE_ELEMENTS,
  SPACEABLE_CONTAINERS,
  SPACING_THRESHOLD,
  TIGHT_GROUP_CHILDREN,
  TIGHT_GROUP_PARENTS,
  TOKEN_LIST_ATTRIBUTES,
} from "./format-helpers.js"

import type {
  ContentUnit,
  ContentUnitWithNode,
  ElementFormattingAnalysis,
} from "./format-helpers.js"

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

    const meaningfulSiblings = siblings.filter(child => isNonWhitespaceNode(child))

    if (meaningfulSiblings.length < SPACING_THRESHOLD) {
      return false
    }

    const parentTagName = parentElement ? getTagName(parentElement) : null

    if (parentTagName && TIGHT_GROUP_PARENTS.has(parentTagName)) {
      return false
    }

    const isSpaceableContainer = !parentTagName || (parentTagName && SPACEABLE_CONTAINERS.has(parentTagName))

    if (!isSpaceableContainer && meaningfulSiblings.length < 5) {
      return false
    }

    const currentNode = siblings[currentIndex]
    const previousMeaningfulIndex = findPreviousMeaningfulSibling(siblings, currentIndex)
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

      if (INLINE_ELEMENTS.has(currentTagName)) {
        return false
      }

      if (TIGHT_GROUP_CHILDREN.has(currentTagName)) {
        return false
      }

      if (currentTagName === 'a' && parentTagName === 'nav') {
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
    const hasTextFlow = this.isInTextFlowContext(null, node.children)

    if (hasTextFlow) {
      const children = filterSignificantChildren(node.children)

      const wasInlineMode = this.inlineMode
      this.inlineMode = true

      this.visitTextFlowChildren(children)

      this.inlineMode = wasInlineMode

      return
    }

    let lastWasMeaningful = false
    let hasHandledSpacing = false

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]

      if (shouldPreserveUserSpacing(child, node.children, i)) {
        this.push("")
        hasHandledSpacing = true
        continue
      }

      if (isPureWhitespaceNode(child)) {
        continue
      }

      if (shouldAppendToLastLine(child, node.children, i)) {
        this.appendChildToLastLine(child, node.children, i)
        lastWasMeaningful = true
        hasHandledSpacing = false
        continue
      }

      if (isNonWhitespaceNode(child) && lastWasMeaningful && !hasHandledSpacing) {
        this.push("")
      }

      this.visit(child)

      if (isNonWhitespaceNode(child)) {
        lastWasMeaningful = true
        hasHandledSpacing = false
      }
    }
  }

  visitHTMLElementNode(node: HTMLElementNode) {
    this.elementStack.push(node)
    this.elementFormattingAnalysis.set(node, this.analyzeElementFormatting(node))

    if (this.inlineMode && node.is_void && this.indentLevel === 0) {
      const openTag = this.capture(() => this.visit(node.open_tag)).join('')
      this.pushToLastLine(openTag)
      this.elementStack.pop()

      return
    }

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
              const normalizedContent = child.content.replace(/\s+/g, ' ')
              const trimmedContent = normalizedContent.trim()

              if (trimmedContent) {
                this.push(trimmedContent)
              } else if (normalizedContent === ' ') {
                this.push(' ')
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

    let leadingHerbDisableComment: Node | null = null
    let leadingHerbDisableIndex = -1
    let firstWhitespaceIndex = -1
    let remainingChildren = children

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
        this.visitTextFlowChildren(remainingChildren)
      } else {
        this.visitElementChildren(leadingHerbDisableComment ? remainingChildren : body, element)
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
          const hasPreviousNonWhitespace = i > 0 && isNonWhitespaceNode(body[i - 1])
          const hasNextNonWhitespace = i < body.length - 1 && isNonWhitespaceNode(body[i + 1])

          const hasMultipleNewlines = child.content.includes('\n\n')

          if (hasPreviousNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
            this.push("")
            hasHandledSpacing = true
          }

          continue
        }
      }

      if (isNonWhitespaceNode(child) && lastWasMeaningful && !hasHandledSpacing) {
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

      let hasTrailingHerbDisable = false

      if (isNode(child, HTMLElementNode) && child.close_tag) {
        for (let j = i + 1; j < body.length; j++) {
          const nextChild = body[j]

          if (isNode(nextChild, WhitespaceNode) || isPureWhitespaceNode(nextChild)) {
            continue
          }

          if (isNode(nextChild, ERBContentNode) && isHerbDisableComment(nextChild)) {
            hasTrailingHerbDisable = true

            this.visit(child)

            const herbDisableString = this.capture(() => {
              const savedIndentLevel = this.indentLevel
              this.indentLevel = 0
              this.inlineMode = true
              this.visit(nextChild)
              this.inlineMode = false
              this.indentLevel = savedIndentLevel
            }).join("")

            this.pushToLastLine(' ' + herbDisableString)

            i = j

            break
          }

          break
        }
      }

      if (!hasTrailingHerbDisable) {
        this.visit(child)
      }

      if (isNonWhitespaceNode(child)) {
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
        if (isNode(child, HTMLTextNode) || isNode(child, LiteralNode)) {
          return child.content
        } else if (isERBNode(child)) {
          return IdentityPrinter.print(child)
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

    this.withIndent(() => this.visitAll(node.children))
    this.visitAll(node.conditions)

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBBlockNode(node: ERBBlockNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      const hasTextFlow = this.isInTextFlowContext(null, node.body)

      if (hasTextFlow) {
        const children = filterSignificantChildren(node.body)
        this.visitTextFlowChildren(children)
      } else {
        this.visitElementChildren(node.body, null)
      }
    })

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

    this.withIndent(() => this.visitAll(node.children))
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
    const children = node.open_tag?.children || []
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
    const children = filterSignificantChildren(node.body)
    const openTagInline = this.shouldRenderOpenTagInline(node)

    if (!openTagInline) return false
    if (children.length === 0) return true

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
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(node.open_tag?.children, HTMLAttributeNode), node.body)

      if (fullInlineResult) {
        const totalLength = this.indent.length + fullInlineResult.length
        return totalLength <= this.maxLineLength || totalLength <= 120
      }

      return false
    }

    const allNestedAreInline = areAllNestedElementsInline(children)
    const hasMultilineText = hasMultilineTextContent(children)
    const hasMixedContent = hasMixedTextAndInlineContent(children)

    if (allNestedAreInline && (!hasMultilineText || hasMixedContent)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(node.open_tag?.children, HTMLAttributeNode), node.body)

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
    if (isContentPreserving(node)) return true

    const children = filterSignificantChildren(node.body)

    if (children.length === 0) return true

    return elementContentInline
  }


  // --- Utility methods ---

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
      this.renderAdjacentInlineElements(children, adjacentInlineCount)
      this.visitRemainingChildren(children, adjacentInlineCount)

      return
    }

    this.buildAndWrapTextFlow(children)
  }

  /**
   * Render adjacent inline elements together on one line
   */
  private renderAdjacentInlineElements(children: Node[], count: number): void {
    let inlineContent = ""
    let processedCount = 0

    for (let i = 0; i < children.length && processedCount < count; i++) {
      const child = children[i]

      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        continue
      }

      if (isNode(child, HTMLElementNode) && isInlineElement(getTagName(child))) {
        inlineContent += this.renderInlineElementAsString(child)
        processedCount++
      } else if (isNode(child, ERBContentNode)) {
        inlineContent += this.renderERBAsString(child)
        processedCount++
      }
    }

    if (inlineContent) {
      this.pushWithIndent(inlineContent)
    }
  }

  /**
   * Render an inline element as a string
   */
  private renderInlineElementAsString(element: HTMLElementNode): string {
    const tagName = getTagName(element)

    if (element.is_void || element.open_tag?.tag_closing?.value === "/>") {
      const attributes = filterNodes(element.open_tag?.children, HTMLAttributeNode)
      const attributesString = this.renderAttributesString(attributes)
      const isSelfClosing = element.open_tag?.tag_closing?.value === "/>"

      return `<${tagName}${attributesString}${isSelfClosing ? " />" : ">"}`
    }

    const childrenToRender = this.getFilteredChildren(element.body)

    const childInline = this.tryRenderInlineFull(element, tagName,
      filterNodes(element.open_tag?.children, HTMLAttributeNode),
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
  private visitRemainingChildren(children: Node[], skipCount: number): void {
    let skipped = 0

    for (const child of children) {
      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        continue
      }

      if (skipped < skipCount) {
        skipped++
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
        const text = unit.content.replace(/\s+/g, ' ')
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
    if (!startsWithAlphanumeric(words[0])) return false

    lastUnit.unit.content += words[0]

    if (words.length > 1) {
      const remainingText = words.slice(1).join(' ')

      result.push({
        unit: { content: remainingText, type: 'text', isAtomic: false, breaksFlow: false },
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

    if (isNode(currentNode, HTMLTextNode) && /^\s/.test(currentNode.content)) {
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

    if (!isAtomic && lastProcessedIndex >= 0) {
      const hasWhitespace = this.hasWhitespaceBeforeNode(children, lastProcessedIndex, index, child)

      if (!hasWhitespace && this.tryMergeTextAfterAtomic(result, child)) {
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
    const inlineContent = this.tryRenderInlineFull(child, tagName, filterNodes(child.open_tag?.children, HTMLAttributeNode), childrenToRender)

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
      if (isPureWhitespaceNode(child) && !(isNode(child, HTMLTextNode) && child.content === ' ')) continue

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
  private tryRenderInlineFull(node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], children: Node[]): string | null {
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
  private tryRenderChildrenInline(children: Node[]): string | null {
    let result = ""
    let hasInternalWhitespace = false

    const hasHerbDisable = this.hasLeadingHerbDisable(children)
    let addedLeadingSpace = false

    for (const child of children) {
      if (isNode(child, HTMLTextNode)) {
        const normalizedContent = child.content.replace(/\s+/g, ' ')
        const hasLeadingSpace = /^\s/.test(child.content)
        const hasTrailingSpace = /\s$/.test(child.content)
        const trimmedContent = normalizedContent.trim()

        if (trimmedContent) {
          if (hasLeadingSpace && result && !result.endsWith(' ')) {
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
          filterNodes(child.open_tag?.children, HTMLAttributeNode),
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

    if (hasHerbDisable && result.startsWith(' ')) {
      return result.trimEnd()
    }

    if (hasInternalWhitespace) {
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

    return hasHerbDisable ? filterEmptyNodesForHerbDisable(body) : filterEmptyNodes(body)
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
}
