import { Visitor } from "@herb-tools/core"

import {
  DocumentNode,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLSelfCloseTagNode,
  HTMLElementNode,
  HTMLAttributeNode,
  HTMLAttributeValueNode,
  HTMLAttributeNameNode,
  HTMLTextNode,
  LiteralNode,
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
} from "@herb-tools/core"

import type { FormatOptions } from "./options.js"

/**
 * Printer traverses the Herb AST using the Visitor pattern
 * and emits a formatted string with proper indentation, line breaks, and attribute wrapping.
 */
export class Printer extends Visitor {
  private indentWidth: number
  private maxLineLength: number
  private source: string
  private lines: string[] = []
  private indentLevel: number = 0

  constructor(source: string, options: Required<FormatOptions>) {
    super()
    this.source = source
    this.indentWidth = options.indentWidth
    this.maxLineLength = options.maxLineLength
  }

  print(node: DocumentNode): string {
    this.lines = []
    this.indentLevel = 0
    this.visit(node)

    return this.lines.filter(Boolean).join("\n")
  }

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

  // --- Visitor methods ---

  visitDocumentNode(node: DocumentNode): void {
    node.children.forEach(child => this.visit(child))
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const open = node.open_tag as HTMLOpenTagNode
    const tagName = open.tag_name?.value ?? ""
    const indent = this.indent()
    const attributes = open.children.filter((child): child is HTMLAttributeNode => child instanceof HTMLAttributeNode)
    const children = node.body.filter(
      child =>
        !(child instanceof WhitespaceNode) &&
        !(child instanceof HTMLTextNode && child.content.trim() === ""),
    )

    if (attributes.length === 0) {
      if (children.length === 0) {
        const single = `<${tagName}${node.is_void ? ' /' : ''}>${node.is_void ? '' : `</${tagName}>`}`
        this.push(indent + single)

        return
      }

      this.push(indent + `<${tagName}>`)

      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      if (!node.is_void) {
        this.push(indent + `</${tagName}>`)
      }

      return
    }

    const inline = this.renderInlineOpen(tagName, attributes, node.is_void)
    const singleAttribute = attributes[0]
    const hasEmptyValue =
      singleAttribute instanceof HTMLAttributeNode &&
      singleAttribute.value instanceof HTMLAttributeValueNode &&
      singleAttribute.value.children.length === 0

    if (
      attributes.length === 1 &&
      !hasEmptyValue &&
      inline.length + indent.length <= this.maxLineLength
    ) {
      if (children.length === 0) {
        this.push(
          indent + `<${tagName} ${this.renderAttribute(attributes[0])}></${tagName}>`
        )
        return
      }

      this.push(indent + inline)

      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      if (!node.is_void) {
        this.push(indent + `</${tagName}>`)
      }

      return
    }

    this.push(indent + `<${tagName}`)
    this.withIndent(() => {
      attributes.forEach(attribute => {
        this.push(this.indent() + this.renderAttribute(attribute))
      })
    })

    if (node.is_void) {
      this.push(indent + "/>")
    } else if (children.length === 0) {
      this.push(indent + ">" + `</${tagName}>`)
    } else {
      this.push(indent + ">")

      this.withIndent(() => {
        children.forEach(child => this.visit(child))
      })

      this.push(indent + `</${tagName}>`)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent()
    const attributes = node.children.filter((attribute): attribute is HTMLAttributeNode => attribute instanceof HTMLAttributeNode)
    const inline = this.renderInlineOpen(tagName, attributes, node.is_void)

    if (attributes.length === 0 || inline.length + indent.length <= this.maxLineLength) {
      this.push(indent + inline)

      return
    }

    this.push(indent + `<${tagName}`)
    this.withIndent(() => {
      attributes.forEach(attribute => {
        this.push(this.indent() + this.renderAttribute(attribute))
      })
    })
    this.push(indent + (node.is_void ? "/>" : ">"))
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent()
    const attributes = node.attributes.filter((attribute): attribute is HTMLAttributeNode => attribute instanceof HTMLAttributeNode)
    const inline = this.renderInlineOpen(tagName, attributes, true)

    if (attributes.length === 0 || inline.length + indent.length <= this.maxLineLength) {
      this.push(indent + inline)
      return
    }

    this.push(indent + `<${tagName}`)
    this.withIndent(() => {
      attributes.forEach(attribute => {
        this.push(this.indent() + this.renderAttribute(attribute))
      })
    })
    this.push(indent + "/>")
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const name = node.tag_name?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + name + close)
  }

  visitHTMLTextNode(node: HTMLTextNode): void {
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

  visitHTMLCommentNode(node: HTMLCommentNode): void {
    const indent = this.indent()
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""
    let inner: string

    if (node.comment_start && node.comment_end) {
      // TODO: use .value
      const [_, startIndex] = node.comment_start.range.toArray()
      const [endIndex] = node.comment_end.range.toArray()
      const rawInner = this.source.slice(startIndex, endIndex)
      inner = ` ${rawInner.trim()} `
    } else {
      inner = node.children.map(child => {
        const prevLines = this.lines.length
        this.visit(child)
        return this.lines.slice(prevLines).join("")
      }).join("")
    }

    this.push(indent + open + inner + close)
  }

  visitHTMLDoctypeNode(node: HTMLDoctypeNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    let innerDoctype: string

    if (node.tag_opening && node.tag_closing) {
      // TODO: use .value
      const [, openingEnd] = node.tag_opening.range.toArray()
      const [closingStart] = node.tag_closing.range.toArray()
      innerDoctype = this.source.slice(openingEnd, closingStart)
    } else {
      innerDoctype = node.children
        .map(child =>
          child instanceof HTMLTextNode ? child.content : (() => { const prevLines = this.lines.length; this.visit(child); return this.lines.slice(prevLines).join("") })(),
        )
        .join("")
    }

    const close = node.tag_closing?.value ?? ""
    this.push(indent + open + innerDoctype + close)
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.visitERBRaw(node)
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.visitERBRaw(node)
  }

  visitERBYieldNode(node: ERBYieldNode): void {
    this.visitERBRaw(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.visitERBRaw(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.visitERBRaw(node)
  }

  private visitERBRaw(node: any): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.body.forEach(child => this.visit(child))
    })

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBIfNode(node: ERBIfNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.statements.forEach(child => this.visit(child))
    })

    if (node.subsequent) {
      this.visit(node.subsequent)
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBElseNode(node: ERBElseNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.statements.forEach(child => this.visit(child))
    })
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.statements.forEach(stmt => this.visit(stmt))
    })
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    const baseLevel = this.indentLevel
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    this.push(indent + open + content + close)

    node.conditions.forEach(condition => this.visit(condition))
    if (node.else_clause) this.visit(node.else_clause)

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      node.statements.forEach(statement => this.visit(statement))
    })

    if (node.rescue_clause) this.visit(node.rescue_clause)
    if (node.else_clause) this.visit(node.else_clause)
    if (node.ensure_clause) this.visit(node.ensure_clause)
    if (node.end_node) this.visit(node.end_node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.visitERBGeneric(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.visitERBGeneric(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.visitERBGeneric(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.visitERBGeneric(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.visitERBGeneric(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.visitERBGeneric(node)
  }

  // TODO: don't use any
  private visitERBGeneric(node: any): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    this.push(indent + open + content + close)

    this.withIndent(() => {
      const statements: any[] = node.statements ?? node.body ?? node.children ?? []

      statements.forEach(statement => this.visit(statement))
    })

    if (node.end_node) this.visit(node.end_node)
  }

  // --- Utility methods ---

  private renderInlineOpen(name: string, attributes: HTMLAttributeNode[], selfClose: boolean): string {
    const parts = attributes.map(attribute => this.renderAttribute(attribute))

    return `<${name}${parts.length ? " " + parts.join(" ") : ""}${selfClose ? " /" : ""}>`
  }

  private renderAttribute(attribute: HTMLAttributeNode): string {
    const name = (attribute.name as HTMLAttributeNameNode)!.name!.value ?? ""
    const equals = attribute.equals?.value ?? ""
    let value = ""

    if (attribute.value instanceof HTMLAttributeValueNode) {
      const open_quote = (attribute.value.open_quote?.value ?? "")
      const close_quote = (attribute.value.close_quote?.value ?? "")
      const attribute_value = attribute.value.children.map(attribute => {
        if (attribute instanceof HTMLTextNode || attribute instanceof LiteralNode) {
          return (attribute as HTMLTextNode | LiteralNode).content
        } else if (attribute instanceof ERBContentNode) {
          return (attribute.tag_opening!.value + attribute.content!.value + attribute.tag_closing!.value)
        }
        return ""
      }).join("")

      value = open_quote + attribute_value + close_quote
    }

    return name + equals + value
  }
}
