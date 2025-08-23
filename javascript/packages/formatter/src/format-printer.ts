import { getCombinedAttributeName, getCombinedStringFromNodes, isERBNode } from "@herb-tools/core"
import { Printer, IdentityPrinter } from "@herb-tools/printer"

import {
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
  Token
} from "@herb-tools/core"

type ERBNode =
  ERBContentNode
| ERBBlockNode
| ERBEndNode
| ERBElseNode
| ERBIfNode
| ERBWhenNode
| ERBCaseNode
| ERBCaseMatchNode
| ERBWhileNode
| ERBUntilNode
| ERBForNode
| ERBRescueNode
| ERBEnsureNode
| ERBBeginNode
| ERBUnlessNode
| ERBYieldNode
| ERBInNode


import type { FormatOptions } from "./options.js"

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
  private isInComplexNesting: boolean = false
  private currentElement: HTMLElementNode | null = null

  public source: string

  private static readonly INLINE_ELEMENTS = new Set([
    'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'br', 'cite', 'code',
    'dfn', 'em', 'i', 'img', 'kbd', 'label', 'map', 'object', 'q',
    'samp', 'small', 'span', 'strong', 'sub', 'sup',
    'tt', 'var', 'del', 'ins', 'mark', 's', 'u', 'time', 'wbr'
  ])

  constructor(source: string, options: Required<FormatOptions>) {
    super()

    this.source = source
    this.indentWidth = options.indentWidth
    this.maxLineLength = options.maxLineLength
  }

  print(object: Node | Token): string {
    if (object instanceof Token || (object as any).type?.startsWith('TOKEN_')) {
      return (object as Token).value
    }

    const node: Node = object

    // TODO: refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
    this.lines = []
    this.indentLevel = 0
    this.isInComplexNesting = false // Reset for each top-level element

    if (typeof (node as any).accept === 'function') {
      node.accept(this)
    } else {
      this.visit(node)
    }

    return this.lines.join("\n")
  }

  /**
   * @deprecated refactor to use @herb-tools/printer infrastructre (or rework printer use push and this.lines)
   */
  private push(line: string) {
    this.lines.push(line)
  }

  private withIndent<T>(callback: () => T): T {
    this.indentLevel++
    const result = callback()
    this.indentLevel--

    return result
  }

  private indent(): string {
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
   * Check if a node is an ERB control flow node (if, unless, block, case, while, for)
   */
  private isERBControlFlow(node: Node): boolean {
    return node instanceof ERBIfNode || (node as any).type === 'AST_ERB_IF_NODE' ||
      node instanceof ERBUnlessNode || (node as any).type === 'AST_ERB_UNLESS_NODE' ||
      node instanceof ERBBlockNode || (node as any).type === 'AST_ERB_BLOCK_NODE' ||
      node instanceof ERBCaseNode || (node as any).type === 'AST_ERB_CASE_NODE' ||
      node instanceof ERBCaseMatchNode || (node as any).type === 'AST_ERB_CASE_MATCH_NODE' ||
      node instanceof ERBWhileNode || (node as any).type === 'AST_ERB_WHILE_NODE' ||
      node instanceof ERBForNode || (node as any).type === 'AST_ERB_FOR_NODE'
  }

  /**
   * Count total attributes including those inside ERB conditionals
   */
  private getTotalAttributeCount(attributes: HTMLAttributeNode[], inlineNodes: Node[] = []): number {
    let totalAttributeCount = attributes.length

    inlineNodes.forEach(node => {
      if (this.isERBControlFlow(node)) {
        const erbNode = node as any
        if (erbNode.statements) {
          totalAttributeCount += erbNode.statements.length
        }
      }
    })

    return totalAttributeCount
  }

  /**
   * Extract HTML attributes from a list of nodes
   */
  private extractAttributes(nodes: Node[]): HTMLAttributeNode[] {
    return nodes.filter((child): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
  }

  /**
   * Extract inline nodes (non-attribute, non-whitespace) from a list of nodes
   */
  private extractInlineNodes(nodes: Node[]): Node[] {
    return nodes.filter(child =>
      !(child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') &&
      !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')
    )
  }

  /**
   * Render attributes as a space-separated string
   */
  private renderAttributesString(attributes: HTMLAttributeNode[]): string {
    if (attributes.length === 0) return ""
    return ` ${attributes.map(attr => this.renderAttribute(attr)).join(" ")}`
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
    _nestingDepth: number = 0,
    _inlineNodesLength: number = 0,
    hasMultilineAttributes: boolean = false
  ): boolean {
    if (hasComplexERB || hasMultilineAttributes) return false

    if (totalAttributeCount === 0) {
      return inlineLength + indentLength <= maxLineLength
    }

    if (totalAttributeCount > 3 || inlineLength + indentLength > maxLineLength) {
      return false
    }

    return true
  }

  private hasMultilineAttributes(attributes: HTMLAttributeNode[]): boolean {
    return attributes.some(attribute => {
      if (attribute.value && (attribute.value instanceof HTMLAttributeValueNode || (attribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE')) {
        const attributeValue = attribute.value as HTMLAttributeValueNode

        const content = getCombinedStringFromNodes(attributeValue.children)

        if (/\r?\n/.test(content)) {
          const attributeNameNode = attribute.name as HTMLAttributeNameNode
          const name = getCombinedAttributeName(attributeNameNode)

          if (name === 'class') {
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

  private formatMultilineAttribute(content: string, name: string, equals: string, open_quote: string, close_quote: string): string {
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
  private renderMultilineAttributes(
    tagName: string,
    _attributes: HTMLAttributeNode[],
    _inlineNodes: Node[] = [],
    allChildren: Node[] = [],
    isSelfClosing: boolean = false,
    isVoid: boolean = false,
    hasBodyContent: boolean = false
  ) {
    const indent = this.indent()
    this.push(indent + `<${tagName}`)

    this.withIndent(() => {
      allChildren.forEach(child => {
        if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
          this.push(this.indent() + this.renderAttribute(child as HTMLAttributeNode))
        } else if (!(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')) {
          this.visit(child)
        }
      })
    })

    if (isSelfClosing) {
      this.push(indent + "/>")
    } else if (isVoid) {
      this.push(indent + ">")
    } else if (!hasBodyContent) {
      this.push(indent + `></${tagName}>`)
    } else {
      this.push(indent + ">")
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
    const indent = this.inlineMode ? "" : this.indent()
    const erbText = this.reconstructERBNode(node, true)

    this.push(indent + erbText)
  }

  // --- Visitor methods ---

  visitDocumentNode(node: DocumentNode) {
    let lastWasMeaningful = false
    let hasHandledSpacing = false

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]

      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textNode = child as HTMLTextNode
        const isWhitespaceOnly = textNode.content.trim() === ""

        if (isWhitespaceOnly) {
          const hasPrevNonWhitespace = i > 0 && this.isNonWhitespaceNode(node.children[i - 1])
          const hasNextNonWhitespace = i < node.children.length - 1 && this.isNonWhitespaceNode(node.children[i + 1])

          const hasMultipleNewlines = textNode.content.includes('\n\n')

          if (hasPrevNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines) {
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
    const open = node.open_tag as HTMLOpenTagNode
    const tagName = open.tag_name?.value ?? ""
    const isSelfClosing = open.tag_closing?.value === "/>"

    this.currentElement = node

    // 1. Visit the open tag (handles just the opening tag)
    this.visit(node.open_tag)

    // 2. Handle element content (if not self-closing and not void)
    if (!isSelfClosing && !node.is_void) {
      this.visitHTMLElementContent(node.body, tagName)
    }

    // 3. Visit the closing tag (if it exists and needed)
    if (!isSelfClosing && !node.is_void && node.close_tag) {
      this.visit(node.close_tag)
    }

    this.currentElement = null
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode) {
    const tagName = node.tag_name?.value ?? ""
    const attributes = this.extractAttributes(node.children)
    const inlineNodes = this.extractInlineNodes(node.children)
    const hasClosing = node.tag_closing?.value === ">" || node.tag_closing?.value === "/>"
    const isSelfClosing = node.tag_closing?.value === "/>"

    if (!hasClosing) {
      const indent = this.indent()
      this.push(indent + `<${tagName}`)
      return
    }

    // Use the simplified open tag printing that only handles the opening tag
    this.printHTMLOpenTag(tagName, attributes, inlineNodes, node.children, isSelfClosing, node.is_void, true)
  }

  /**
   * Visit HTML element content - handles the body of an HTML element
   */
  visitHTMLElementContent(children: Node[], tagName: string) {
    const hasTextFlow = this.isInTextFlowContext(null, children)
    const significantChildren = this.filterSignificantChildren(children, hasTextFlow)

    // If no content, check if this should be an inline empty element
    if (significantChildren.length === 0) {
      this.handleEmptyElementContent()
      return
    }

    // Check if content should be rendered inline
    if (this.shouldRenderContentInline(significantChildren, tagName)) {
      this.renderContentInline(significantChildren)
      return
    }

    // Render content normally (multiline)
    this.printHTMLElementContent(significantChildren, hasTextFlow, tagName)
  }

  /**
   * Handle empty element content - may render the element inline
   */
  private handleEmptyElementContent() {
    if (!this.currentElement) return

    const open = this.currentElement.open_tag as HTMLOpenTagNode
    const attributes = this.extractAttributes(open.children)
    const inlineNodes = this.extractInlineNodes(open.children)

    // For simple empty elements, we can render them inline by going back and modifying the last line
    if (attributes.length <= 2 && inlineNodes.length === 0) {
      const tagName = open.tag_name?.value ?? ""
      const lastLine = this.lines[this.lines.length - 1]

      // Replace the opening tag line with the complete inline element
      if (lastLine && lastLine.includes(`<${tagName}`)) {
        this.lines[this.lines.length - 1] = lastLine.replace(`<${tagName}`, `<${tagName}`).replace('>', `></${tagName}>`)
        // Skip the closing tag by marking element as complete
        this.currentElement.close_tag = null
      }
    }
  }

  /**
   * Check if content should be rendered inline
   */
  private shouldRenderContentInline(children: Node[], tagName: string): boolean {
    if (children.length !== 1) return false

    const child = children[0]
    if (!(child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE')) return false

    const textContent = (child as HTMLTextNode).content.trim()
    if (!textContent || textContent.includes('\n')) return false

    if (!this.currentElement) return false

    const open = this.currentElement.open_tag as HTMLOpenTagNode
    const attributes = this.extractAttributes(open.children)
    const inlineNodes = this.extractInlineNodes(open.children)

    // Simple elements with short text and not too many attributes
    return textContent.length < 50 && attributes.length <= 2 && inlineNodes.length === 0
  }

  /**
   * Render content inline (modify the last opening tag line to include content)
   */
  private renderContentInline(children: Node[]) {
    if (!this.currentElement) return

    const child = children[0]
    if (!(child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE')) return

    const textContent = (child as HTMLTextNode).content.trim()
    const tagName = this.currentElement.open_tag?.tag_name?.value ?? ""
    const lastLine = this.lines[this.lines.length - 1]

    // Replace the opening tag line with the complete inline element
    if (lastLine && lastLine.endsWith('>')) {
      this.lines[this.lines.length - 1] = lastLine.replace('>', `>${textContent}</${tagName}>`)
      // Skip the closing tag by marking element as complete
      this.currentElement.close_tag = null
    }
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode) {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const name = node.tag_name?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + name + close)
  }

  visitHTMLTextNode(node: HTMLTextNode) {
    if (this.inlineMode) {
      const normalizedContent = node.content.replace(/\s+/g, ' ').trim()

      if (normalizedContent) {
        this.push(normalizedContent)
      }

      return
    }

    const indent = this.indent()
    let text = node.content.trim()

    if (!text) return

    const wrapWidth = this.maxLineLength - indent.length
    const words = text.split(/\s+/)
    const lines: string[] = []

    let line = ""

    for (const word of words) {
      if ((line + (line ? " " : "") + word).length > wrapWidth && line) {
        lines.push(indent + line)
        line = word
      } else {
        line += (line ? " " : "") + word
      }
    }

    if (line) lines.push(indent + line)

    lines.forEach(line => this.push(line))
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode) {
    const indent = this.indent()

    this.push(indent + this.renderAttribute(node))
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode) {
    const indent = this.indent()
    const name = getCombinedAttributeName(node)

    this.push(indent + name)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode) {
    const indent = this.indent()
    const open_quote = node.open_quote?.value ?? ""
    const close_quote = node.close_quote?.value ?? ""

    const attribute_value = node.children.map(child => {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE' ||
          child instanceof LiteralNode || (child as any).type === 'AST_LITERAL_NODE') {

        return (child as HTMLTextNode | LiteralNode).content
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        const erbChild = child as ERBContentNode

        return (erbChild.tag_opening!.value + erbChild.content!.value + erbChild.tag_closing!.value)
      }

      return ""
    }).join("")

    this.push(indent + open_quote + attribute_value + close_quote)
  }

  visitHTMLCommentNode(node: HTMLCommentNode) {
    const indent = this.indent()
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""

    let inner: string

    if (node.children && node.children.length > 0) {
      inner = node.children.map(child => {
        if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
          return (child as HTMLTextNode).content
        } else if (child instanceof LiteralNode || (child as any).type === 'AST_LITERAL_NODE') {
          return (child as LiteralNode).content
        } else if (isERBNode(child) || child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
          return this.reconstructERBNode(child as ERBContentNode, false)
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

    this.push(indent + open + inner + close)
  }

  visitERBCommentNode(node: ERBContentNode) {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    let inner: string

    if (node.content && node.content.value) {
      const rawInner = node.content.value
      const lines = rawInner.split("\n")

      if (lines.length > 2) {
        const childIndent = indent + " ".repeat(this.indentWidth)
        const innerLines = lines.slice(1, -1).map(line => childIndent + line.trim())

        inner = "\n" + innerLines.join("\n") + "\n"
      } else {
        inner = ` ${rawInner.trim()} `
      }
    } else if ((node as any).children) {
      inner = (node as any).children.map((child: any) => {
        const prevLines = this.lines.length

        this.visit(child)

        return this.lines.slice(prevLines).join("")
      }).join("")
    } else {
      inner = ""
    }

    this.push(indent + open + inner + close)
  }

  visitHTMLDoctypeNode(node: HTMLDoctypeNode) {
    const indent = this.indent()

    this.push(indent + IdentityPrinter.print(node))
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

    this.withIndent(() => {
      node.statements.forEach(stmt => this.visit(stmt))
    })
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode) {
    this.printERBNode(node)

    node.conditions.forEach(condition => this.visit(condition))

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBBlockNode(node: ERBBlockNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      node.body.forEach(child => this.visit(child))
    })

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBIfNode(node: ERBIfNode) {
    if (this.inlineMode) {
      this.printERBNode(node)

      node.statements.forEach((child, _index) => {
        this.lines.push(" ")

        if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
          this.lines.push(this.renderAttribute(child as HTMLAttributeNode))
        } else {
          this.visit(child)
        }
      })

      if (node.statements.length > 0 && node.end_node) {
        this.lines.push(" ")
      }

      if (node.subsequent) {
        this.visit(node.subsequent)
      }

      if (node.end_node) {
        const endNode = node.end_node as any
        const endOpen = endNode.tag_opening?.value ?? ""
        const endContent = endNode.content?.value ?? ""
        const endClose = endNode.tag_closing?.value ?? ""
        const endInner = this.formatERBContent(endContent)

        this.lines.push(endOpen + endInner + endClose)
      }
    } else {
      this.printERBNode(node)

      this.withIndent(() => {
        node.statements.forEach(child => this.visit(child))
      })

      if (node.subsequent) {
        this.visit(node.subsequent)
      }

      if (node.end_node) {
        this.printERBNode(node.end_node as any)
      }
    }
  }

  visitERBElseNode(node: ERBElseNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(child => this.visit(child))
    })
  }

  visitERBWhenNode(node: ERBWhenNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(stmt => this.visit(stmt))
    })
  }

  visitERBCaseNode(node: ERBCaseNode) {
    this.printERBNode(node)

    node.conditions.forEach(condition => this.visit(condition))
    if (node.else_clause) this.visit(node.else_clause)

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: ERBBeginNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(statement => this.visit(statement))
    })

    if (node.rescue_clause) this.visit(node.rescue_clause)
    if (node.else_clause) this.visit(node.else_clause)
    if (node.ensure_clause) this.visit(node.ensure_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBWhileNode(node: ERBWhileNode) {
    this.visitERBGeneric(node)
  }

  visitERBUntilNode(node: ERBUntilNode) {
    this.visitERBGeneric(node)
  }

  visitERBForNode(node: ERBForNode) {
    this.visitERBGeneric(node)
  }

  visitERBRescueNode(node: ERBRescueNode) {
    this.visitERBGeneric(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode) {
    this.visitERBGeneric(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode) {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(statement => this.visit(statement))
    })

    if (node.else_clause) this.visit(node.else_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  // TODO: don't use any
  private visitERBGeneric(node: any) {
    this.printERBNode(node)

    this.withIndent(() => {
      const statements: any[] = node.statements ?? node.body ?? node.children ?? []

      statements.forEach(statement => this.visit(statement))
    })

    if (node.end_node) this.visit(node.end_node)
  }

  // --- HTML Element Printing Methods ---

  /**
   * Print HTML opening tag with attributes and inline nodes
   */
  private printHTMLOpenTag(
    tagName: string,
    attributes: HTMLAttributeNode[],
    inlineNodes: Node[] = [],
    allChildren: Node[] = [],
    isSelfClosing: boolean = false,
    isVoid: boolean = false,
    renderInline: boolean = true
  ): void {
    const indent = this.indent()

    if (renderInline) {
      const inline = this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, allChildren)
      this.push(indent + inline)
    } else {
      this.renderMultilineAttributes(tagName, attributes, inlineNodes, allChildren, isSelfClosing, isVoid, false)
    }
  }


  /**
   * Handle open tag rendering when visited as part of an HTMLElementNode
   */
  private handleElementOpenTag(
    element: HTMLElementNode,
    openTag: HTMLOpenTagNode,
    tagName: string,
    attributes: HTMLAttributeNode[],
    inlineNodes: Node[],
    isSelfClosing: boolean
  ): void {
    const hasTextFlow = this.isInTextFlowContext(null, element.body)
    const children = this.filterSignificantChildren(element.body, hasTextFlow)
    const isInlineElement = this.isInlineElement(tagName)

    if (attributes.length === 0 && inlineNodes.length === 0) {
      this.handleSimpleElementOpenTag(element, tagName, children, hasTextFlow, isSelfClosing)
      return
    }

    if (attributes.length === 0 && inlineNodes.length > 0) {
      this.printHTMLOpenTag(tagName, attributes, inlineNodes, openTag.children, isSelfClosing, element.is_void, true)
      return
    }

    this.handleComplexElementOpenTag(element, openTag, tagName, attributes, inlineNodes, children, isSelfClosing, isInlineElement, hasTextFlow)
  }

  /**
   * Handle simple element open tag (no attributes or inline nodes)
   */
  private handleSimpleElementOpenTag(
    element: HTMLElementNode,
    tagName: string,
    children: Node[],
    hasTextFlow: boolean,
    isSelfClosing: boolean
  ): void {
    // Handle empty elements
    if (children.length === 0) {
      if (isSelfClosing) {
        this.printHTMLOpenTag(tagName, [], [], [], true, element.is_void, true)
        this.elementRenderedCompletely = true
      } else if (element.is_void) {
        this.printHTMLOpenTag(tagName, [], [], [], false, true, true)
        this.elementRenderedCompletely = true
      } else {
        // Empty element with opening and closing tag on same line
        const indent = this.indent()
        this.push(indent + `<${tagName}></${tagName}>`)
        this.elementRenderedCompletely = true
      }
      return
    }

    // Try to render inline if possible
    if (this.canRenderSimpleInline(tagName, children, hasTextFlow)) {
      const fullInlineResult = this.tryRenderInlineFull(element, tagName, [], children)
      if (fullInlineResult) {
        const indent = this.indent()
        const totalLength = indent.length + fullInlineResult.length
        const maxNesting = this.getMaxNestingDepth(children, 0)
        const maxInlineLength = maxNesting <= 1 ? this.maxLineLength : 60

        if (totalLength <= maxInlineLength) {
          this.push(indent + fullInlineResult)
          // Mark that the element was rendered completely inline
          this.elementRenderedCompletely = true
          return
        }
      }
    }

    // Render as regular opening tag
    this.printHTMLOpenTag(tagName, [], [], [], isSelfClosing, element.is_void, true)
  }

  /**
   * Handle complex element open tag (with attributes and/or inline nodes)
   */
  private handleComplexElementOpenTag(
    element: HTMLElementNode,
    openTag: HTMLOpenTagNode,
    tagName: string,
    attributes: HTMLAttributeNode[],
    inlineNodes: Node[],
    children: Node[],
    isSelfClosing: boolean,
    isInlineElement: boolean,
    hasTextFlow: boolean
  ): void {
    const hasERBControlFlow = inlineNodes.some(node => this.isERBControlFlow(node)) || openTag.children.some(node => this.isERBControlFlow(node))
    const hasComplexERB = hasERBControlFlow && this.hasComplexERBControlFlow(inlineNodes)

    const indent = this.indent()
    const inline = hasComplexERB ? "" : this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, openTag.children)
    const nestingDepth = this.getMaxNestingDepth(children, 0)
    const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)

    const shouldKeepInline = this.shouldRenderInline(
      totalAttributeCount,
      inline.length,
      indent.length,
      this.maxLineLength,
      hasComplexERB,
      nestingDepth,
      inlineNodes.length,
      this.hasMultilineAttributes(attributes)
    )

    if (shouldKeepInline) {
      this.printHTMLOpenTag(tagName, attributes, inlineNodes, openTag.children, isSelfClosing, element.is_void, true)
    } else {
      this.printHTMLOpenTag(tagName, attributes, inlineNodes, openTag.children, isSelfClosing, element.is_void, false)
    }
  }

  /**
   * Check if simple element can be rendered inline
   */
  private canRenderSimpleInline(tagName: string, children: Node[], hasTextFlow: boolean): boolean {
    if (this.isInComplexNesting && children.length === 1) {
      const child = children[0]
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textContent = (child as HTMLTextNode).content.trim()
        return !textContent.includes('\n')
      }
    }

    if (!this.isInComplexNesting) {
      if (hasTextFlow) {
        const hasAnyNewlines = children.some(child => {
          if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
            return (child as HTMLTextNode).content.includes('\n')
          }
          return false
        })
        return !hasAnyNewlines
      }
      return true
    }

    return false
  }

  /**
   * Print HTML element content (children)
   * Handles special formatting for script, style, pre, and textarea elements
   */
  private printHTMLElementContent(children: Node[], hasTextFlow: boolean = false, tagName: string = ''): void {
    const specialTags = ['script', 'style', 'pre', 'textarea']

    if (specialTags.includes(tagName.toLowerCase())) {
      this.printSpecialElementContent(children, tagName.toLowerCase())
    } else {
      this.visitElementChildren(children, hasTextFlow)
    }
  }

  /**
   * Print content for special elements that need raw content preservation
   */
  private printSpecialElementContent(children: Node[], tagName: string): void {
    if (children.length === 0) return

    // For special tags, use IdentityPrinter to preserve original formatting
    this.withIndent(() => {
      children.forEach(child => {
        const content = IdentityPrinter.print(child)
        const lines = content.split('\n')
        const indent = this.indent()

        lines.forEach(line => {
          this.push(indent + line)
        })
      })
    })
  }

  /**
   * Handle simple HTML elements (no attributes or inline nodes)
   */
  private handleSimpleElement(
    node: HTMLElementNode,
    tagName: string,
    children: Node[],
    hasTextFlow: boolean,
    isSelfClosing: boolean
  ): void {
    // Handle empty elements
    if (children.length === 0) {
      if (this.handleSimpleEmptyElement(tagName, isSelfClosing, node.is_void)) {
        return
      }
    }

    // Try to render inline if possible
    if (children.length >= 1) {
      if (this.tryRenderSimpleInline(tagName, children, hasTextFlow)) {
        return
      }
    }

    // Try full inline rendering for text flow contexts
    if (hasTextFlow) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, [], children)
      if (fullInlineResult) {
        const totalLength = this.indent().length + fullInlineResult.length
        const maxNesting = this.getMaxNestingDepth(children, 0)
        const maxInlineLength = maxNesting <= 1 ? this.maxLineLength : 60

        if (totalLength <= maxInlineLength) {
          this.push(this.indent() + fullInlineResult)
          this.elementRenderedCompletely = true
          return
        }
      }
    }

    // Render as multiline element
    this.renderElementWithBody(tagName, children, hasTextFlow, node.is_void, isSelfClosing, node.close_tag)
  }


  // --- Utility methods ---

  /**
   * Get the current tag name from the current element context
   */
  private get currentTagName(): string {
    if (!this.currentElement) return ""
    const openTag = this.currentElement.open_tag as HTMLOpenTagNode
    return openTag.tag_name?.value ?? ""
  }

  private isNonWhitespaceNode(node: Node): boolean {
    if (node instanceof HTMLTextNode || (node as any).type === 'AST_HTML_TEXT_NODE') {
      return (node as HTMLTextNode).content.trim() !== ""
    }

    if (node instanceof WhitespaceNode || (node as any).type === 'AST_WHITESPACE_NODE') {
      return false
    }

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
    const indent = this.indent()
    let currentLineContent = ""

    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const content = (child as HTMLTextNode).content

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

          if ((indent.length + currentLineContent.length) > Math.max(this.maxLineLength, 120)) {
            this.visitTextFlowChildrenMultiline(children)

            return
          }
        }
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode
        const childTagName = openTag?.tag_name?.value || ''

        if (this.isInlineElement(childTagName)) {
          const childInline = this.tryRenderInlineFull(element, childTagName,
            this.extractAttributes(openTag.children),
            element.body.filter(c => !(c instanceof WhitespaceNode || (c as any).type === 'AST_WHITESPACE_NODE') &&
              !((c instanceof HTMLTextNode || (c as any).type === 'AST_HTML_TEXT_NODE') && (c as any)?.content.trim() === "")))

          if (childInline) {
            currentLineContent += childInline

            if ((indent.length + currentLineContent.length) > this.maxLineLength) {
              this.visitTextFlowChildrenMultiline(children)

              return
            }
          } else {
            if (currentLineContent.trim()) {
              this.push(indent + currentLineContent.trim())
              currentLineContent = ""
            }

            this.visit(child)
          }
        } else {
          if (currentLineContent.trim()) {
            this.push(indent + currentLineContent.trim())
            currentLineContent = ""
          }

          this.visit(child)
        }
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        const oldLines = this.lines
        const oldInlineMode = this.inlineMode

        try {
          this.lines = []
          this.inlineMode = true
          this.visit(child)
          const erbContent = this.lines.join("")
          currentLineContent += erbContent

          if ((indent.length + currentLineContent.length) > Math.max(this.maxLineLength, 120)) {
            this.lines = oldLines
            this.inlineMode = oldInlineMode
            this.visitTextFlowChildrenMultiline(children)

            return
          }
        } finally {
          this.lines = oldLines
          this.inlineMode = oldInlineMode
        }
      } else {
        if (currentLineContent.trim()) {
          this.push(indent + currentLineContent.trim())
          currentLineContent = ""
        }

        this.visit(child)
      }
    }

    if (currentLineContent.trim()) {
      const finalLine = indent + currentLineContent.trim()
      if (finalLine.length > Math.max(this.maxLineLength, 120)) {
        this.visitTextFlowChildrenMultiline(children)

        return
      }
      this.push(finalLine)
    }
  }

  private visitTextFlowChildrenMultiline(children: Node[]) {
    children.forEach(child => this.visit(child))
  }

  private isInTextFlowContext(_parent: Node | null, children: Node[]): boolean {
    const hasTextContent = children.some(child =>
      (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') &&
      (child as HTMLTextNode).content.trim() !== ""
    )

    if (!hasTextContent) {
      return false
    }

    const nonTextChildren = children.filter(child =>
      !(child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE')
    )

    if (nonTextChildren.length === 0) {
      return false
    }

    const allInline = nonTextChildren.every(child => {
      if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        return true
      }

      if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode
        const tagName = openTag?.tag_name?.value || ''

        return this.isInlineElement(tagName)
      }

      return false
    })

    if (!allInline) {
      return false
    }

    const maxNestingDepth = this.getMaxNestingDepth(children, 0)

    if (maxNestingDepth > 2) {
      return false
    }

    return true
  }

  private renderInlineOpen(name: string, attributes: HTMLAttributeNode[], selfClose: boolean, inlineNodes: Node[] = [], allChildren: Node[] = []): string {
    const parts = attributes.map(attribute => this.renderAttribute(attribute))

    if (inlineNodes.length > 0) {
      let result = `<${name}`

      if (allChildren.length > 0) {
        const currentIndentLevel = this.indentLevel
        this.indentLevel = 0
        const tempLines = this.lines
        this.lines = []

        allChildren.forEach(child => {
          if (child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE') {
            this.lines.push(" " + this.renderAttribute(child as HTMLAttributeNode))
          } else if (!(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE')) {
            const wasInlineMode = this.inlineMode

            this.inlineMode = true

            this.lines.push(" ")
            this.visit(child)
            this.inlineMode = wasInlineMode
          }
        })

        const inlineContent = this.lines.join("")
        this.lines = tempLines
        this.indentLevel = currentIndentLevel

        result += inlineContent
      } else {
        if (parts.length > 0) {
          result += ` ${parts.join(" ")}`
        }

        const currentIndentLevel = this.indentLevel
        this.indentLevel = 0
        const tempLines = this.lines
        this.lines = []

        inlineNodes.forEach(node => {
          const wasInlineMode = this.inlineMode

          if (!this.isERBControlFlow(node)) {
            this.inlineMode = true
          }

          this.visit(node)

          this.inlineMode = wasInlineMode
        })

        const inlineContent = this.lines.join("")
        this.lines = tempLines
        this.indentLevel = currentIndentLevel

        result += inlineContent
      }

      result += selfClose ? " />" : ">"

      return result
    }

    return `<${name}${parts.length ? " " + parts.join(" ") : ""}${selfClose ? " /" : ""}>`
  }

  renderAttribute(attribute: HTMLAttributeNode): string {
    const attributeNameNode = attribute.name as HTMLAttributeNameNode
    const name = getCombinedAttributeName(attributeNameNode)
    const equals = attribute.equals?.value ?? ""

    let value = ""

    if (attribute.value && (attribute.value instanceof HTMLAttributeValueNode || (attribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE')) {
      const attributeValue = attribute.value as HTMLAttributeValueNode

      let open_quote = attributeValue.open_quote?.value ?? ""
      let close_quote = attributeValue.close_quote?.value ?? ""
      let htmlTextContent = ""

      const content = attributeValue.children.map((child: Node) => {
        if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE' || child instanceof LiteralNode || (child as any).type === 'AST_LITERAL_NODE') {
          const textContent = (child as HTMLTextNode | LiteralNode).content
          htmlTextContent += textContent

          return textContent
        } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
          const erbAttribute = child as ERBContentNode

          return erbAttribute.tag_opening!.value + erbAttribute.content!.value + erbAttribute.tag_closing!.value
        }

        return ""
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
          value = this.formatMultilineAttribute(content, name, equals, open_quote, close_quote)
        }
      } else {
        value = open_quote + content + close_quote
      }
    }

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
    if (!childrenContent) {
      return null
    }

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
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const content = (child as HTMLTextNode).content
        const normalizedContent = content.replace(/\s+/g, ' ')
        const hasLeadingSpace = /^\s/.test(content)
        const hasTrailingSpace = /\s$/.test(content)
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

      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode
        const childTagName = openTag?.tag_name?.value || ''

        if (!this.isInlineElement(childTagName)) {
          return null
        }

        const childInline = this.tryRenderInlineFull(element, childTagName,
          this.extractAttributes(openTag.children),
          element.body.filter(c => !(c instanceof WhitespaceNode || (c as any).type === 'AST_WHITESPACE_NODE') &&
            !((c instanceof HTMLTextNode || (c as any).type === 'AST_HTML_TEXT_NODE') && (c as any)?.content.trim() === ""))
        )

        if (!childInline) {
          return null
        }

        result += childInline
      } else {
        const oldLines = this.lines
        const oldInlineMode = this.inlineMode
        const oldIndentLevel = this.indentLevel

        try {
          this.lines = []
          this.inlineMode = true
          this.indentLevel = 0
          this.visit(child)

          result += this.lines.join("")
        } finally {
          this.lines = oldLines
          this.inlineMode = oldInlineMode
          this.indentLevel = oldIndentLevel
        }
      }
    }

    return result.trim()
  }

  /**
   * Try to render children inline if they are simple enough.
   * Returns the inline string if possible, null otherwise.
   */
  private tryRenderInline(children: Node[], tagName: string, _depth: number = 0, forceInline: boolean = false, hasTextFlow: boolean = false): string | null {
    if (!forceInline && children.length > 10) {
      return null
    }

    const maxNestingDepth = this.getMaxNestingDepth(children, 0)

    let maxAllowedDepth = forceInline ? 5 : (tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'].includes(tagName) ? 1 : 2)

    if (hasTextFlow && maxNestingDepth >= 2) {
      const roughContentLength = this.estimateContentLength(children)

      if (roughContentLength > 47) {
        maxAllowedDepth = 1
      }
    }

    if (!forceInline && maxNestingDepth > maxAllowedDepth) {
      this.isInComplexNesting = true

      return null
    }

    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textContent = (child as HTMLTextNode).content

        if (textContent.includes('\n')) {
          return null
        }
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode
        const elementTagName = openTag?.tag_name?.value || ''
        const isInlineElement = this.isInlineElement(elementTagName)

        if (!isInlineElement) {
          return null
        }

      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        // ERB content nodes are allowed in inline rendering
      } else {
        return null
      }
    }

    const oldLines = this.lines
    const oldInlineMode = this.inlineMode

    try {
      this.lines = []
      this.inlineMode = true

      let content = ''

      for (const child of children) {
        if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
          content += (child as HTMLTextNode).content
        } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
          const element = child as HTMLElementNode
          const openTag = element.open_tag as HTMLOpenTagNode
          const childTagName = openTag?.tag_name?.value || ''

          const attributes = this.extractAttributes(openTag.children)

          const attributesString = this.renderAttributesString(attributes)

          const elementContent = this.renderElementInline(element)

          content += `<${childTagName}${attributesString}>${elementContent}</${childTagName}>`
        } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
          const erbNode = child as ERBContentNode
          const open = erbNode.tag_opening?.value ?? ""
          const erbContent = erbNode.content?.value ?? ""
          const close = erbNode.tag_closing?.value ?? ""

          content += `${open}${this.formatERBContent(erbContent)}${close}`
        }
      }

      content = content.replace(/\s+/g, ' ').trim()

      return `<${tagName}>${content}</${tagName}>`

    } finally {
      this.lines = oldLines
      this.inlineMode = oldInlineMode
    }
  }

  /**
   * Estimate the total content length of children nodes for decision making.
   */
  private estimateContentLength(children: Node[]): number {
    let length = 0

    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        length += (child as HTMLTextNode).content.length
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const openTag = element.open_tag as HTMLOpenTagNode
        const tagName = openTag?.tag_name?.value || ''

        length += tagName.length + 5 // Rough estimate for tag overhead
        length += this.estimateContentLength(element.body)
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        length += (child as ERBContentNode).content?.value.length || 0
      }
    }
    return length
  }

  /**
   * Calculate the maximum nesting depth in a subtree of nodes.
   */
  private getMaxNestingDepth(children: Node[], currentDepth: number): number {
    let maxDepth = currentDepth

    for (const child of children) {
      if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const element = child as HTMLElementNode
        const elementChildren = element.body.filter(
          child =>
            !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
            !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
        )

        const childDepth = this.getMaxNestingDepth(elementChildren, currentDepth + 1)
        maxDepth = Math.max(maxDepth, childDepth)
      }
    }

    return maxDepth
  }

  /**
   * Visit and render children nodes of an element
   */
  private visitElementChildren(children: Node[], hasTextFlow: boolean = false) {
    if (children.length === 0) return

    this.withIndent(() => {
      if (hasTextFlow) {
        this.visitTextFlowChildren(children)
      } else {
        children.forEach(child => this.visit(child))
      }
    })
  }

  /**
   * Handle simple empty elements (no attributes, no inline nodes)
   */
  private handleSimpleEmptyElement(tagName: string, isSelfClosing: boolean, isVoid: boolean): boolean {
    if (isSelfClosing || isVoid) {
      this.printHTMLOpenTag(tagName, [], [], [], isSelfClosing, isVoid, true)
    } else {
      // Empty element with opening and closing tag on same line
      const indent = this.indent()
      this.push(indent + `<${tagName}></${tagName}>`)
    }
    return true
  }

  /**
   * Try to render element content inline if possible
   */
  private tryRenderSimpleInline(tagName: string, children: Node[], hasTextFlow: boolean): boolean {
    const indent = this.indent()

    if (this.isInComplexNesting && children.length === 1) {
      const child = children[0]
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const textContent = (child as HTMLTextNode).content.trim()
        const singleLine = `<${tagName}>${textContent}</${tagName}>`

        if (!textContent.includes('\n') && (indent.length + singleLine.length) <= this.maxLineLength) {
          this.push(indent + singleLine)
          return true
        }
      }
    }

    if (!this.isInComplexNesting) {
      const inlineResult = this.tryRenderInline(children, tagName, 0, false, hasTextFlow)
      if (inlineResult && (indent.length + inlineResult.length) <= this.maxLineLength) {
        this.push(indent + inlineResult)
        return true
      }

      if (hasTextFlow) {
        const hasAnyNewlines = children.some(child => {
          if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
            return (child as HTMLTextNode).content.includes('\n')
          }
          return false
        })

        if (!hasAnyNewlines) {
          const fullInlineResult = this.tryRenderInlineFull(
            { open_tag: { tag_name: { value: tagName } }, body: children } as any,
            tagName, [], children
          )

          if (fullInlineResult) {
            const totalLength = indent.length + fullInlineResult.length
            const maxNesting = this.getMaxNestingDepth(children, 0)
            const maxInlineLength = maxNesting <= 1 ? this.maxLineLength : 60

            if (totalLength <= maxInlineLength) {
              this.push(indent + fullInlineResult)
              return true
            }
          }
        }
      }
    }

    return false
  }

  /**
   * Render element with body content (opening tag, children, closing tag)
   */
  private renderElementWithBody(tagName: string, children: Node[], hasTextFlow: boolean, isVoid: boolean, isSelfClosing: boolean, closeTag?: HTMLCloseTagNode) {
    // Print opening tag
    this.printHTMLOpenTag(tagName, [], [], [], isSelfClosing, isVoid, true)

    // Print element content
    if (children.length > 0) {
      this.printHTMLElementContent(children, hasTextFlow, tagName)
    }
  }

  /**
   * Handle element with inline nodes (ERB conditionals, etc.)
   */
  private handleElementWithInlineNodes(node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], inlineNodes: Node[], children: Node[], isSelfClosing: boolean, hasTextFlow: boolean) {
    const open = node.open_tag as HTMLOpenTagNode

    // Print opening tag with inline nodes
    this.printHTMLOpenTag(tagName, attributes, inlineNodes, open.children, isSelfClosing, node.is_void, true)

    // Handle special case for elements with no content
    if (children.length === 0) {
      if (!isSelfClosing && !node.is_void) {
        // Need to append closing tag directly since it was rendered inline
        const lastLine = this.lines[this.lines.length - 1]
        this.lines[this.lines.length - 1] = lastLine + `</${tagName}>`
      }
      return
    }

    // Print element content
    this.printHTMLElementContent(children, hasTextFlow, tagName)

    // Note: Closing tag is now handled by visitHTMLElementNode
  }

  /**
   * Check if element has complex ERB control flow
   */
  private hasComplexERBControlFlow(inlineNodes: Node[]): boolean {
    return inlineNodes.some(node => {
      if (node instanceof ERBIfNode || (node as any).type === 'AST_ERB_IF_NODE') {
        const erbNode = node as ERBIfNode
        if (erbNode.statements.length > 0 && erbNode.location) {
          const startLine = erbNode.location.start.line
          const endLine = erbNode.location.end.line
          return startLine !== endLine
        }
        return false
      }
      return false
    })
  }

  /**
   * Handle complex element with attributes and possible ERB control flow
   */
  private handleComplexElement(node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], inlineNodes: Node[], children: Node[], isSelfClosing: boolean, isInlineElement: boolean, hasTextFlow: boolean) {
    const open = node.open_tag as HTMLOpenTagNode
    const indent = this.indent()

    const hasERBControlFlow = inlineNodes.some(node => this.isERBControlFlow(node)) || open.children.some(node => this.isERBControlFlow(node))
    const hasComplexERB = hasERBControlFlow && this.hasComplexERBControlFlow(inlineNodes)

    const inline = hasComplexERB ? "" : this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, open.children)
    const nestingDepth = this.getMaxNestingDepth(children, 0)
    const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)

    const shouldKeepInline = this.shouldRenderInline(
      totalAttributeCount,
      inline.length,
      indent.length,
      this.maxLineLength,
      hasComplexERB,
      nestingDepth,
      inlineNodes.length,
      this.hasMultilineAttributes(attributes)
    )

    if (shouldKeepInline) {
      this.handleInlineElement(node, tagName, attributes, inlineNodes, children, isSelfClosing, isInlineElement, hasTextFlow, hasERBControlFlow, inline)
    } else {
      this.handleMultilineElement(node, tagName, attributes, inlineNodes, children, isSelfClosing, hasTextFlow, hasERBControlFlow)
    }
  }

  /**
   * Handle rendering of inline element
   */
  private handleInlineElement(node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], inlineNodes: Node[], children: Node[], isSelfClosing: boolean, isInlineElement: boolean, hasTextFlow: boolean, hasERBControlFlow: boolean, inline: string) {
    const indent = this.indent()

    if (children.length === 0) {
      if (isSelfClosing || node.is_void) {
        this.push(indent + inline)
      } else {
        this.renderEmptyElementWithAttributes(tagName, attributes, inlineNodes)
      }
      return
    }

    if (isInlineElement && !hasERBControlFlow) {
      const fullInlineResult = this.tryRenderInlineFull(node, tagName, attributes, children)
      if (fullInlineResult) {
        const totalLength = indent.length + fullInlineResult.length
        if (totalLength <= this.maxLineLength || totalLength <= 120) {
          this.push(indent + fullInlineResult)
          return
        }
      }
    }

    if (!isInlineElement && !hasERBControlFlow) {
      this.push(indent + inline)
      this.visitElementChildren(children, hasTextFlow)
      if (!node.is_void && !isSelfClosing) {
        this.push(indent + `</${tagName}>`)
      }
      return
    }

    if (isSelfClosing) {
      this.push(indent + inline.replace(' />', '>'))
    } else {
      this.push(indent + inline)
    }

    this.visitElementChildren(children, hasTextFlow)

    if (!node.is_void && !isSelfClosing) {
      this.push(indent + `</${tagName}>`)
    }
  }

  /**
   * Render empty element with attributes
   */
  private renderEmptyElementWithAttributes(tagName: string,attributes: HTMLAttributeNode[],inlineNodes: Node[]) {
    const indent = this.indent()
    let result = `<${tagName}`

    result += this.renderAttributesString(attributes)

    if (inlineNodes.length > 0) {
      const currentIndentLevel = this.indentLevel
      this.indentLevel = 0
      const tempLines = this.lines
      this.lines = []

      inlineNodes.forEach(node => {
        const wasInlineMode = this.inlineMode
        if (!this.isERBControlFlow(node)) {
          this.inlineMode = true
        }
        this.visit(node)
        this.inlineMode = wasInlineMode
      })

      const inlineContent = this.lines.join("")
      this.lines = tempLines
      this.indentLevel = currentIndentLevel
      result += inlineContent
    }

    result += `></${tagName}>`
    this.push(indent + result)
  }

  /**
   * Handle multiline element rendering
   */
  private handleMultilineElement(node: HTMLElementNode, tagName: string, attributes: HTMLAttributeNode[], inlineNodes: Node[], children: Node[], isSelfClosing: boolean, hasTextFlow: boolean, hasERBControlFlow: boolean) {
    const open = node.open_tag as HTMLOpenTagNode
    const indent = this.indent()
    const isInlineElement = this.isInlineElement(tagName)

    if (inlineNodes.length > 0 && hasERBControlFlow) {
      this.renderMultilineAttributes(tagName, attributes, inlineNodes, open.children, isSelfClosing, node.is_void, children.length > 0)

      if (!isSelfClosing && !node.is_void && children.length > 0) {
        this.printHTMLElementContent(children, hasTextFlow, tagName)
        // Note: Closing tag is now handled by visitHTMLElementNode
      }
    } else if (inlineNodes.length > 0) {
      this.push(indent + this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, open.children))

      if (!isSelfClosing && !node.is_void && children.length > 0) {
        this.printHTMLElementContent(children, hasTextFlow, tagName)
        // Note: Closing tag is now handled by visitHTMLElementNode
      }
    } else {
      if (isInlineElement && children.length > 0) {
        const fullInlineResult = this.tryRenderInlineFull(node, tagName, attributes, children)

        if (fullInlineResult) {
          const totalLength = indent.length + fullInlineResult.length

          if (totalLength <= this.maxLineLength || totalLength <= 120) {
            this.push(indent + fullInlineResult)

            return
          }
        }
      }

      if (isInlineElement && children.length === 0) {
        const inline = this.renderInlineOpen(tagName, attributes, isSelfClosing, inlineNodes, open.children)
        const totalAttributeCount = this.getTotalAttributeCount(attributes, inlineNodes)
        const shouldKeepInline = this.shouldRenderInline(
          totalAttributeCount,
          inline.length,
          indent.length,
          this.maxLineLength,
          false,
          0,
          inlineNodes.length,
          this.hasMultilineAttributes(attributes)
        )

        if (shouldKeepInline) {
          let result = `<${tagName}`
          result += this.renderAttributesString(attributes)

          if (isSelfClosing) {
            result += " />"
          } else if (node.is_void) {
            result += ">"
          } else {
            result += `></${tagName}>`
          }

          this.push(indent + result)

          return
        }
      }

      this.renderMultilineAttributes(tagName, attributes, inlineNodes, open.children, isSelfClosing, node.is_void, children.length > 0)

      if (!isSelfClosing && !node.is_void && children.length > 0) {
        this.printHTMLElementContent(children, hasTextFlow, tagName)
        // Note: Closing tag is now handled by visitHTMLElementNode
      }
    }
  }

  /**
   * Filter children to remove insignificant whitespace
   */
  private filterSignificantChildren(body: Node[], hasTextFlow: boolean): Node[] {
    return body.filter(child => {
      if (child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') {
        return false
      }

      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        const content = (child as HTMLTextNode).content
        if (hasTextFlow && content === " ") {
          return true
        }
        return content.trim() !== ""
      }

      return true
    })
  }

  private renderElementInline(element: HTMLElementNode): string {
    const children = element.body.filter(
      child =>
        !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
        !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
    )

    let content = ''

    for (const child of children) {
      if (child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') {
        content += (child as HTMLTextNode).content
      } else if (child instanceof HTMLElementNode || (child as any).type === 'AST_HTML_ELEMENT_NODE') {
        const childElement = child as HTMLElementNode
        const openTag = childElement.open_tag as HTMLOpenTagNode
        const childTagName = openTag?.tag_name?.value || ''

        const attributes = this.extractAttributes(openTag.children)
        const attributesString = this.renderAttributesString(attributes)
        const childContent = this.renderElementInline(childElement)

        content += `<${childTagName}${attributesString}>${childContent}</${childTagName}>`
      } else if (child instanceof ERBContentNode || (child as any).type === 'AST_ERB_CONTENT_NODE') {
        content += this.reconstructERBNode(child as ERBContentNode, true)
      }
    }

    return content.replace(/\s+/g, ' ').trim()
  }
}
