import { IdentityPrinter } from "@herb-tools/printer"
import { HTMLAttributeNode, HTMLAttributeValueNode, HTMLTextNode, LiteralNode, ERBContentNode } from "@herb-tools/core"

import { getCombinedAttributeName, getCombinedStringFromNodes, isNode } from "@herb-tools/core"

import { ASCII_WHITESPACE, FORMATTABLE_ATTRIBUTES, TOKEN_LIST_ATTRIBUTES } from "./format-helpers.js"

import type { Node, ERBNode } from "@herb-tools/core"

/**
 * Interface that the delegate must implement to provide
 * ERB reconstruction capabilities to the AttributeRenderer.
 */
export interface AttributeRendererDelegate {
  reconstructERBNode(node: ERBNode, withFormatting: boolean): string
}

/**
 * AttributeRenderer converts HTMLAttributeNode AST nodes into formatted strings.
 * It handles class attribute wrapping, multiline attribute formatting,
 * quote normalization, and token list attribute spacing.
 */
export class AttributeRenderer {
  private delegate: AttributeRendererDelegate
  private maxLineLength: number
  private indentWidth: number

  public currentAttributeName: string | null = null
  public indentLevel: number = 0

  constructor(
    delegate: AttributeRendererDelegate,
    maxLineLength: number,
    indentWidth: number,
  ) {
    this.delegate = delegate
    this.maxLineLength = maxLineLength
    this.indentWidth = indentWidth
  }

  /**
   * Check if we're currently processing a token list attribute that needs spacing
   */
  get isInTokenListAttribute(): boolean {
    return this.currentAttributeName !== null && TOKEN_LIST_ATTRIBUTES.has(this.currentAttributeName)
  }

  /**
   * Render attributes as a space-separated string
   */
  renderAttributesString(attributes: HTMLAttributeNode[], tagName: string): string {
    if (attributes.length === 0) return ""

    return ` ${attributes.map(attribute => this.renderAttribute(attribute, tagName)).join(" ")}`
  }

  /**
   * Determine if a tag should be rendered inline based on attribute count and other factors
   */
  shouldRenderInline(
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

  wouldClassAttributeBeMultiline(content: string, indentLength: number): boolean {
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
  getAttributeName(attribute: HTMLAttributeNode): string {
    return attribute.name ? getCombinedAttributeName(attribute.name) : ""
  }

  // TOOD: extract to core or reuse function from core
  getAttributeValue(attribute: HTMLAttributeNode): string {
    if (isNode(attribute.value, HTMLAttributeValueNode)) {
      return attribute.value.children.map(child => isNode(child, HTMLTextNode) ? child.content : IdentityPrinter.print(child)).join('')
    }

    return ''
  }

  hasMultilineAttributes(attributes: HTMLAttributeNode[]): boolean {
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

  formatClassAttribute(content: string, name: string, equals: string, open_quote: string, close_quote: string): string {
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

  isFormattableAttribute(attributeName: string, tagName: string): boolean {
    const globalFormattable = FORMATTABLE_ATTRIBUTES['*'] || []
    const tagSpecificFormattable = FORMATTABLE_ATTRIBUTES[tagName.toLowerCase()] || []

    return globalFormattable.includes(attributeName) || tagSpecificFormattable.includes(attributeName)
  }

  formatMultilineAttribute(content: string, name: string, open_quote: string, close_quote: string): string {
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

  formatMultilineAttributeValue(lines: string[]): string {
    const indent = " ".repeat((this.indentLevel + 1) * this.indentWidth)
    const closeIndent = " ".repeat(this.indentLevel * this.indentWidth)

    return "\n" + lines.map(line => indent + line).join("\n") + "\n" + closeIndent
  }

  breakTokensIntoLines(tokens: string[], currentIndent: number, separator: string = ' '): string[] {
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

  renderAttribute(attribute: HTMLAttributeNode, tagName: string): string {
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
          return this.delegate.reconstructERBNode(child, true)
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

      if (this.isFormattableAttribute(name, tagName)) {
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
}
