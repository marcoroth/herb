import { Printer, IdentityPrinter } from "@herb-tools/printer"
import { TextFlowEngine } from "./text-flow-engine.js"
import { AttributeRenderer } from "./attribute-renderer.js"
import { SpacingAnalyzer } from "./spacing-analyzer.js"
import { isTextFlowNode } from "./text-flow-helpers.js"
import { extractHTMLCommentContent, formatHTMLCommentInner, formatERBCommentLines } from "./comment-helpers.js"

import type { ERBNode } from "@herb-tools/core"
import type { FormatOptions } from "./options.js"
import type { TextFlowDelegate } from "./text-flow-engine.js"
import type { AttributeRendererDelegate } from "./attribute-renderer.js"
import type { ElementFormattingAnalysis } from "./format-helpers.js"

interface ChildVisitResult {
  newIndex: number
  lastMeaningfulNode: Node | null
  hasHandledSpacing: boolean
}

import {
  getTagName,
  getCombinedAttributeName,
  isNode,
  isToken,
  isParseResult,
  isNoneOf,
  isERBNode,
  isERBControlFlowNode,
  isERBCommentNode,
  isHTMLOpenTagNode,
  filterNodes,
} from "@herb-tools/core"

import {
  areAllNestedElementsInline,
  filterEmptyNodesForHerbDisable,
  filterSignificantChildren,
  hasComplexERBControlFlow,
  hasMixedTextAndInlineContent,
  hasMultilineTextContent,
  isContentPreserving,
  isFrontmatter,
  hasLeadingHerbDisable,
  isHerbDisableComment,
  isInlineElement,
  isNonWhitespaceNode,
  isPureWhitespaceNode,
  shouldAppendToLastLine,
  shouldPreserveUserSpacing,
} from "./format-helpers.js"

import {
  ASCII_WHITESPACE,
  SPACEABLE_CONTAINERS,
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
export class FormatPrinter extends Printer implements TextFlowDelegate, AttributeRendererDelegate {
  /**
   * @deprecated integrate indentWidth into this.options and update FormatOptions to extend from @herb-tools/printer options
   */
  private indentWidth: number

  /**
   * @deprecated integrate maxLineLength into this.options and update FormatOptions to extend from @herb-tools/printer options
   */
  maxLineLength: number

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  private lines: string[] = []
  private indentLevel: number = 0
  private inlineMode: boolean = false
  private inContentPreservingContext: boolean = false
  private inConditionalOpenTagContext: boolean = false
  private elementStack: HTMLElementNode[] = []
  private elementFormattingAnalysis = new Map<HTMLElementNode, ElementFormattingAnalysis>()
  private nodeIsMultiline = new Map<Node, boolean>()
  private stringLineCount: number = 0
  private textFlow: TextFlowEngine
  private attributeRenderer: AttributeRenderer
  private spacingAnalyzer: SpacingAnalyzer

  public source: string

  constructor(source: string, options: Required<FormatOptions>) {
    super()

    this.source = source
    this.indentWidth = options.indentWidth
    this.maxLineLength = options.maxLineLength
    this.textFlow = new TextFlowEngine(this)
    this.attributeRenderer = new AttributeRenderer(this, this.maxLineLength, this.indentWidth)
    this.spacingAnalyzer = new SpacingAnalyzer(this.nodeIsMultiline)
  }

  print(input: Node | ParseResult | Token): string {
    if (isToken(input)) return input.value

    const node: Node = isParseResult(input) ? input.value : input

    // TODO: refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
    this.lines = []
    this.indentLevel = 0
    this.stringLineCount = 0
    this.nodeIsMultiline.clear()
    this.spacingAnalyzer.clear()

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
  push(line: string) {
    this.lines.push(line)
    this.stringLineCount++
  }

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  pushWithIndent(line: string) {
    const indent = line.trim() === "" ? "" : this.indent

    this.push(indent + line)
  }

  private withIndent<T>(callback: () => T): T {
    this.indentLevel++
    const result = callback()
    this.indentLevel--

    return result
  }

  private withInlineMode<T>(callback: () => T): T {
    const was = this.inlineMode
    this.inlineMode = true
    const result = callback()
    this.inlineMode = was

    return result
  }

  private withContentPreserving<T>(callback: () => T): T {
    const was = this.inContentPreservingContext
    this.inContentPreservingContext = true
    const result = callback()
    this.inContentPreservingContext = was

    return result
  }

  get indent(): string {
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
          this.withInlineMode(() => {
            this.lines.push(" ")
            this.visit(comment)
          })
        })
      })

      openingLine += commentLines.join("")
    }

    this.pushWithIndent(openingLine)

    this.withIndent(() => {
      this.attributeRenderer.indentLevel = this.indentLevel
      allChildren.forEach(child => {
        if (isNode(child, HTMLAttributeNode)) {
          this.pushWithIndent(this.attributeRenderer.renderAttribute(child, tagName))
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
  reconstructERBNode(node: ERBNode, withFormatting: boolean = true): string {
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
    const hasTextFlow = this.textFlow.isInTextFlowContext(children)

    if (hasTextFlow) {
      this.withInlineMode(() => {
        this.textFlow.visitTextFlowChildren(children)
      })

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
        const shouldAddSpacing = this.spacingAnalyzer.shouldAddSpacingBetweenSiblings( null, children, i)

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
    if (isContentPreserving(element) || this.inContentPreservingContext) {
      this.visitContentPreservingBody(element)
      return
    }

    const tagName = getTagName(element)
    const analysis = this.elementFormattingAnalysis.get(element)
    const hasTextFlow = this.textFlow.isInTextFlowContext(body)
    const children = filterSignificantChildren(body)

    if (analysis?.elementContentInline) {
      this.visitInlineElementBody(body, tagName, hasTextFlow, children)
      return
    }

    if (children.length === 0) return

    const { comment, hasLeadingWhitespace, remainingChildren, remainingBody } = this.stripLeadingHerbDisable(children, body)

    if (comment) {
      const herbDisableString = this.captureHerbDisableInline(comment)
      this.pushToLastLine((hasLeadingWhitespace ? ' ' : '') + herbDisableString)
    }

    if (remainingChildren.length === 0) return

    this.withIndent(() => {
      if (hasTextFlow) {
        this.textFlow.visitTextFlowChildren(remainingBody)
      } else {
        this.visitElementChildren(comment ? remainingChildren : body, element)
      }
    })
  }

  private visitContentPreservingBody(element: HTMLElementNode) {
    this.withContentPreserving(() => {
      element.body.map(child => {
        if (isNode(child, HTMLElementNode)) {
          const formattedElement = this.withInlineMode(() => this.capture(() => this.visit(child)).join(""))
          this.pushToLastLine(formattedElement)
        } else {
          this.pushToLastLine(IdentityPrinter.print(child))
        }
      })
    })
  }

  private visitInlineElementBody(body: Node[], tagName: string, hasTextFlow: boolean, children: Node[]) {
    if (children.length === 0) return

    const nodesToRender = hasTextFlow ? body : children

    const hasOnlyTextContent = nodesToRender.every(child => isNode(child, HTMLTextNode) || isNode(child, WhitespaceNode))
    const shouldPreserveSpaces = hasOnlyTextContent && isInlineElement(tagName)

    const lines = this.withInlineMode(() => {
      return this.capture(() => {
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
    })

    const content = lines.join('')

    const inlineContent = shouldPreserveSpaces
      ? (hasTextFlow ? content.replace(ASCII_WHITESPACE, ' ') : content)
      : (hasTextFlow ? content.replace(ASCII_WHITESPACE, ' ').trim() : content.trim())

    if (inlineContent) {
      this.pushToLastLine(inlineContent)
    }
  }

  private stripLeadingHerbDisable(children: Node[], body: Node[]): {
    comment: Node | null
    hasLeadingWhitespace: boolean
    remainingChildren: Node[]
    remainingBody: Node[]
  } {
    let leadingHerbDisableComment: Node | null = null
    let leadingHerbDisableIndex = -1
    let firstWhitespaceIndex = -1

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

    if (!leadingHerbDisableComment || leadingHerbDisableIndex < 0) {
      return { comment: null, hasLeadingWhitespace: false, remainingChildren: children, remainingBody: body }
    }

    const filterOut = (nodes: Node[]) => nodes.filter((_, index) => {
      if (index === leadingHerbDisableIndex) return false

      if (firstWhitespaceIndex >= 0 && index === leadingHerbDisableIndex - 1) {
        const child = nodes[index]

        if (isNode(child, WhitespaceNode) || isPureWhitespaceNode(child)) {
          return false
        }
      }

      return true
    })

    return {
      comment: leadingHerbDisableComment,
      hasLeadingWhitespace: firstWhitespaceIndex >= 0 && firstWhitespaceIndex < leadingHerbDisableIndex,
      remainingChildren: filterOut(children),
      remainingBody: filterOut(body),
    }
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

      const textFlowResult = this.visitTextFlowRunInChildren(body, index, lastMeaningfulNode, hasHandledSpacing)

      if (textFlowResult) {
        index = textFlowResult.newIndex
        lastMeaningfulNode = textFlowResult.lastMeaningfulNode
        hasHandledSpacing = textFlowResult.hasHandledSpacing
        continue
      }

      const herbDisableResult: ChildVisitResult | null =
        isNode(child, HTMLElementNode) && child.close_tag
          ? this.visitChildWithTrailingHerbDisable(child, body, index, parentElement, lastMeaningfulNode, hasHandledSpacing)
          : null

      if (herbDisableResult) {
        index = herbDisableResult.newIndex
        lastMeaningfulNode = herbDisableResult.lastMeaningfulNode
        hasHandledSpacing = herbDisableResult.hasHandledSpacing
        continue
      }

      if (shouldAppendToLastLine(child, body, index)) {
        this.appendChildToLastLine(child, body, index)
        lastMeaningfulNode = child
        hasHandledSpacing = false
        continue
      }

      const childStartLine = this.stringLineCount
      this.visit(child)

      if (lastMeaningfulNode && !hasHandledSpacing) {
        const shouldAddSpacing = this.spacingAnalyzer.shouldAddSpacingBetweenSiblings(parentElement, body, index)

        if (shouldAddSpacing) {
          this.lines.splice(childStartLine, 0, "")
          this.stringLineCount++
        }
      }

      lastMeaningfulNode = child
      hasHandledSpacing = false
    }
  }

  private visitTextFlowRunInChildren(body: Node[], index: number, lastMeaningfulNode: Node | null, hasHandledSpacing: boolean): ChildVisitResult | null {
    const child = body[index]

    if (!isTextFlowNode(child)) return null

    const run = this.textFlow.collectTextFlowRun(body, index)

    if (!run) return null

    if (lastMeaningfulNode && !hasHandledSpacing) {
      const hasBlankLineBefore = this.spacingAnalyzer.hasBlankLineBetween(body, index)

      if (hasBlankLineBefore) {
        this.push("")
      }
    }

    this.textFlow.visitTextFlowChildren(run.nodes)

    const lastRunNode = run.nodes[run.nodes.length - 1]
    const hasBlankLineInTrailing = isNode(lastRunNode, HTMLTextNode) && lastRunNode.content.includes('\n\n')
    const hasBlankLineAfter = hasBlankLineInTrailing || this.spacingAnalyzer.hasBlankLineBetween(body, run.endIndex)

    if (hasBlankLineAfter) {
      this.push("")
    }

    return {
      newIndex: run.endIndex - 1,
      lastMeaningfulNode: run.nodes[run.nodes.length - 1],
      hasHandledSpacing: hasBlankLineAfter,
    }
  }

  private visitChildWithTrailingHerbDisable(child: HTMLElementNode, body: Node[], index: number, parentElement: HTMLElementNode | null, lastMeaningfulNode: Node | null, hasHandledSpacing: boolean): ChildVisitResult | null {
    for (let j = index + 1; j < body.length; j++) {
      const nextChild = body[j]

      if (isNode(nextChild, WhitespaceNode) || isPureWhitespaceNode(nextChild)) {
        continue
      }

      if (isNode(nextChild, ERBContentNode) && isHerbDisableComment(nextChild)) {
        const childStartLine = this.stringLineCount
        this.visit(child)

        if (lastMeaningfulNode && !hasHandledSpacing) {
          const shouldAddSpacing = this.spacingAnalyzer.shouldAddSpacingBetweenSiblings(parentElement, body, index)

          if (shouldAddSpacing) {
            this.lines.splice(childStartLine, 0, "")
            this.stringLineCount++
          }
        }

        const herbDisableString = this.captureHerbDisableInline(nextChild)

        this.pushToLastLine(' ' + herbDisableString)

        return {
          newIndex: j,
          lastMeaningfulNode: child,
          hasHandledSpacing: false,
        }
      }

      break
    }

    return null
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
    this.attributeRenderer.indentLevel = this.indentLevel
    const shouldKeepInline = this.attributeRenderer.shouldRenderInline(
      totalAttributeCount,
      inline.length,
      this.indent.length,
      this.maxLineLength,
      false,
      this.attributeRenderer.hasMultilineAttributes(attributes),
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
    this.attributeRenderer.indentLevel = this.indentLevel
    this.pushWithIndent(this.attributeRenderer.renderAttribute(node, this.currentTagName))
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode) {
    this.pushWithIndent(getCombinedAttributeName(node))
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode) {
    this.pushWithIndent(IdentityPrinter.print(node))
  }

  visitHTMLCommentNode(node: HTMLCommentNode) {
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""
    const rawInner = node.children && node.children.length > 0
      ? extractHTMLCommentContent(node.children)
      : ""
    const inner = rawInner ? formatHTMLCommentInner(rawInner, this.indentWidth) : ""

    this.pushWithIndent(open + inner + close)
  }

  visitERBCommentNode(node: ERBContentNode) {
    const result = formatERBCommentLines(
      node.tag_opening?.value || "<%#",
      node?.content?.value || "",
      node.tag_closing?.value || "%>"
    )

    if (result.type === 'single-line') {
      if (this.inlineMode) {
        this.push(result.text)
      } else {
        this.pushWithIndent(result.text)
      }
    } else {
      this.pushWithIndent(result.header)

      this.withIndent(() => {
        result.contentLines.forEach(line => this.pushWithIndent(line))
      })

      this.pushWithIndent(result.footer)
    }
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
        const hasTextFlow = this.textFlow.isInTextFlowContext(node.body)

        if (hasTextFlow) {
          this.textFlow.visitTextFlowChildren(node.body)
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
            this.attributeRenderer.indentLevel = this.indentLevel
            this.lines.push(this.attributeRenderer.renderAttribute(child, this.currentTagName))
          } else {
            const shouldAddSpaces = this.attributeRenderer.isInTokenListAttribute

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
        const isTokenList = this.attributeRenderer.isInTokenListAttribute

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
    this.attributeRenderer.indentLevel = this.indentLevel
    const hasMultilineAttrs = this.attributeRenderer.hasMultilineAttributes(attributes)

    if (hasMultilineAttrs) return false

    const inline = this.renderInlineOpen(
      getTagName(node),
      attributes,
      openTag?.tag_closing?.value === "/>",
      inlineNodes,
      children
    )

    return this.attributeRenderer.shouldRenderInline(
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
    const openTagClosing = getOpenTagClosing(node)

    if (!openTagInline) return false
    if (children.length === 0) return true

    const hasNonInlineChildElements = children.some(child => {
      if (isNode(child, HTMLElementNode)) {
        return !this.shouldRenderElementContentInline(child)
      }

      return false
    })

    if (hasNonInlineChildElements) return false

    if (hasLeadingHerbDisable(node.body) && !isInlineElement(tagName)) {
      return false
    }

    if (isInlineElement(tagName)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(getOpenTagChildren(node), HTMLAttributeNode), node.body)

      if (fullInlineResult) {
        return this.fitsOnCurrentLine(fullInlineResult)
      }

      return false
    }

    if (SPACEABLE_CONTAINERS.has(tagName)) {
      const allChildrenAreERB = children.length > 1 && children.every(child => isERBNode(child))

      if (allChildrenAreERB) return false
    }

    if (!isInlineElement(tagName) && openTagClosing) {
      const first = children[0]
      const startsOnNewLine = first.location.start.line > openTagClosing.location.end.line
      const hasLeadingNewline = isNode(first, HTMLTextNode) && /^\s*\n/.test(first.content)
      const contentStartsOnNewLine = startsOnNewLine || hasLeadingNewline

      if (contentStartsOnNewLine) {
        const hasERBChildren = children.some(child => isERBNode(child))

        if (hasERBChildren || hasMixedTextAndInlineContent(children)) {
          return false
        }
      }
    }

    const allNestedAreInline = areAllNestedElementsInline(children)
    const hasMultilineText = hasMultilineTextContent(children)
    const hasMixedContent = hasMixedTextAndInlineContent(children)

    if (allNestedAreInline && (!hasMultilineText || hasMixedContent)) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, filterNodes(getOpenTagChildren(node), HTMLAttributeNode), node.body)

      if (fullInlineResult && this.fitsOnCurrentLine(fullInlineResult)) {
        return true
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

      if (this.fitsOnCurrentLine(fullLine)) {
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

  private captureHerbDisableInline(node: Node): string {
    return this.capture(() => {
      const savedIndentLevel = this.indentLevel
      this.indentLevel = 0
      this.withInlineMode(() => this.visit(node))
      this.indentLevel = savedIndentLevel
    }).join("")
  }

  private fitsOnCurrentLine(content: string): boolean {
    return this.indent.length + content.length <= this.maxLineLength
  }

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

      const inlineContent = this.withInlineMode(() => this.capture(() => this.visit(child)).join(""))
      this.pushToLastLine((hasSpaceBefore ? " " : "") + inlineContent)
    }
  }


  // --- TextFlowDelegate implementation ---

  /**
   * Render an inline element as a string
   */
  renderInlineElementAsString(element: HTMLElementNode): string {
    const tagName = getTagName(element)
    const tagClosing = getOpenTagClosing(element)

    if (element.is_void || tagClosing?.value === "/>") {
      const attributes = filterNodes(getOpenTagChildren(element), HTMLAttributeNode)
      this.attributeRenderer.indentLevel = this.indentLevel
      const attributesString = this.attributeRenderer.renderAttributesString(attributes, tagName)
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
  renderERBAsString(node: ERBContentNode): string {
    return this.withInlineMode(() => this.capture(() => this.visit(node)).join(""))
  }

  /**
   * Try to render an inline element, returning the full inline string or null if it can't be inlined.
   */
  tryRenderInlineElement(element: HTMLElementNode): string | null {
    const tagName = getTagName(element)
    const childrenToRender = this.getFilteredChildren(element.body)

    return this.tryRenderInlineFull(element, tagName, filterNodes(getOpenTagChildren(element), HTMLAttributeNode), childrenToRender)
  }


  private renderInlineOpen(name: string, attributes: HTMLAttributeNode[], selfClose: boolean, inlineNodes: Node[] = [], allChildren: Node[] = []): string {
    this.attributeRenderer.indentLevel = this.indentLevel
    const parts = attributes.map(attribute => this.attributeRenderer.renderAttribute(attribute, name))

    if (inlineNodes.length > 0) {
      let result = `<${name}`

      if (allChildren.length > 0) {
        const lines = this.capture(() => {
          allChildren.forEach(child => {
            if (isNode(child, HTMLAttributeNode)) {
              this.lines.push(" " + this.attributeRenderer.renderAttribute(child, name))
            } else if (!(isNode(child, WhitespaceNode))) {
              this.withInlineMode(() => {
                this.lines.push(" ")
                this.visit(child)
              })
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
            if (!isERBControlFlowNode(node)) {
              this.withInlineMode(() => this.visit(node))
            } else {
              this.visit(node)
            }
          })
        })

        result += lines.join("")
      }

      result += selfClose ? " />" : ">"

      return result
    }

    return `<${name}${parts.length ? " " + parts.join(" ") : ""}${selfClose ? " />" : ">"}`
  }

  /**
   * Try to render a complete element inline including opening tag, children, and closing tag
   */
  private tryRenderInlineFull(_node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], children: Node[]): string | null {
    let result = `<${tagName}`

    this.attributeRenderer.indentLevel = this.indentLevel
    result += this.attributeRenderer.renderAttributesString(attributes, tagName)
    result += ">"

    const childrenContent = this.tryRenderChildrenInline(children, tagName)

    if (!childrenContent) return null

    result += childrenContent
    result += `</${tagName}>`

    return result
  }

  /**
   * Try to render just the children inline (without tags)
   */
  private tryRenderChildrenInline(children: Node[], tagName?: string): string | null {
    let result = ""
    let hasInternalWhitespace = false
    let addedLeadingSpace = false

    const hasHerbDisable = hasLeadingHerbDisable(children)
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
        const captured = this.withInlineMode(() => this.capture(() => this.visit(child)).join(""))
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
        this.attributeRenderer.indentLevel = this.indentLevel
        const attributesString = this.attributeRenderer.renderAttributesString(attributes, tagName)
        const childContent = this.renderElementInline(child)

        content += `<${tagName}${attributesString}>${childContent}</${tagName}>`
      } else if (isNode(child, ERBContentNode)) {
        content += this.reconstructERBNode(child, true)
      }
    }

    return content.replace(ASCII_WHITESPACE, ' ').trim()
  }
}
