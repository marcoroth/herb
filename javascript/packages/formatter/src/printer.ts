import { Visitor } from "@herb-tools/core"

import {
  Node,
  DocumentNode,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLSelfCloseTagNode,
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

  print(object: Node | Token, indentLevel: number = 0): string {
    if (object instanceof Token || (object as any).type?.startsWith('TOKEN_')) {
      return (object as Token).value
    }

    const node: Node = object

    this.lines = []
    this.indentLevel = indentLevel

    if (typeof (node as any).accept === 'function') {
      node.accept(this)
    } else {
      this.visit(node)
    }

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

  /**
   * Print an ERB tag (<% %> or <%= %>) with single spaces around inner content.
   */
  private printERBNode(node: ERBNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    let inner: string
    if (node.tag_opening && node.tag_closing) {
      const [, openingEnd] = node.tag_opening.range.toArray()
      const [closingStart] = node.tag_closing.range.toArray()
      const rawInner = this.source.slice(openingEnd, closingStart)
      inner = ` ${rawInner.trim()} `
    } else {
      const txt = node.content?.value ?? ""
      inner = txt.trim() ? ` ${txt.trim()} ` : ""
    }
    this.push(indent + open + inner + close)
  }

  // --- Visitor methods ---

  visitDocumentNode(node: DocumentNode): void {
    node.children.forEach(child => this.visit(child))
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const open = node.open_tag as HTMLOpenTagNode
    const tagName = open.tag_name?.value ?? ""
    const indent = this.indent()

    const attributes = open.children.filter((child): child is HTMLAttributeNode =>
      child instanceof HTMLAttributeNode || (child as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
    const children = node.body.filter(
      child =>
        !(child instanceof WhitespaceNode || (child as any).type === 'AST_WHITESPACE_NODE') &&
        !((child instanceof HTMLTextNode || (child as any).type === 'AST_HTML_TEXT_NODE') && (child as any)?.content.trim() === ""),
    )

    // Check if this is a malformed/incomplete tag (missing closing >)
    const hasClosing = open.tag_closing?.value === ">"

    if (!hasClosing) {
      // For malformed tags, just output the tag name without any closing
      this.push(indent + `<${tagName}`)

      return
    }

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
      singleAttribute &&
      (singleAttribute.value instanceof HTMLAttributeValueNode || (singleAttribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE') &&
      (singleAttribute.value as any)?.children.length === 0

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
    const attributes = node.children.filter((attribute): attribute is HTMLAttributeNode =>
      attribute instanceof HTMLAttributeNode || (attribute as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )

    // Check if this is a malformed/incomplete tag (missing closing >)
    const hasClosing = node.tag_closing?.value === ">"

    if (!hasClosing) {
      // For malformed tags, just output the tag name without any closing
      this.push(indent + `<${tagName}`)
      return
    }

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
    const attributes = node.attributes.filter((attribute): attribute is HTMLAttributeNode =>
      attribute instanceof HTMLAttributeNode || (attribute as any).type === 'AST_HTML_ATTRIBUTE_NODE'
    )
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

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const indent = this.indent()
    this.push(indent + this.renderAttribute(node))
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    const indent = this.indent()
    const name = node.name?.value ?? ""
    this.push(indent + name)
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
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

  visitERBCommentNode(node: ERBContentNode): void {
    const indent = this.indent()
    const open = node.tag_opening?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    let inner: string

    if (node.tag_opening && node.tag_closing) {
      const [, openingEnd] = node.tag_opening.range.toArray()
      const [closingStart] = node.tag_closing.range.toArray()
      const rawInner = this.source.slice(openingEnd, closingStart)
      const lines = rawInner.split("\n")
      if (lines.length > 2) {
        const childIndent = indent + " ".repeat(this.indentWidth)
        const innerLines = lines.slice(1, -1).map(line => childIndent + line.trim())
        inner = "\n" + innerLines.join("\n") + "\n"
      } else {
        inner = ` ${rawInner.trim()} `
      }
    } else {
      inner = (node as any).children
        .map((child: any) => {
          const prevLines = this.lines.length
          this.visit(child)
          return this.lines.slice(prevLines).join("")
        })
        .join("")
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
    // TODO: this feels hacky
    if (node.tag_opening?.value === "<%#") {
      this.visitERBCommentNode(node)
    } else {
      this.printERBNode(node)
    }
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.printERBNode(node)
  }

  visitERBYieldNode(node: ERBYieldNode): void {
    this.printERBNode(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.printERBNode(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.printERBNode(node)
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

  visitERBElseNode(node: ERBElseNode): void {
    this.printERBNode(node)

    this.withIndent(() => {
      node.statements.forEach(child => this.visit(child))
    })
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.printERBNode(node)

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

  renderAttribute(attribute: HTMLAttributeNode): string {
    const name = (attribute.name as HTMLAttributeNameNode)!.name!.value ?? ""
    const equals = attribute.equals?.value ?? ""
    let value = ""

    if (attribute.value && (attribute.value instanceof HTMLAttributeValueNode || (attribute.value as any)?.type === 'AST_HTML_ATTRIBUTE_VALUE_NODE')) {
      const attrValue = attribute.value as HTMLAttributeValueNode
      const open_quote = (attrValue.open_quote?.value ?? "")
      const close_quote = (attrValue.close_quote?.value ?? "")
      const attribute_value = attrValue.children.map((attr: any) => {
        if (attr instanceof HTMLTextNode || (attr as any).type === 'AST_HTML_TEXT_NODE' ||
            attr instanceof LiteralNode || (attr as any).type === 'AST_LITERAL_NODE') {
          return (attr as HTMLTextNode | LiteralNode).content
        } else if (attr instanceof ERBContentNode || (attr as any).type === 'AST_ERB_CONTENT_NODE') {
          const erbAttr = attr as ERBContentNode
          return (erbAttr.tag_opening!.value + erbAttr.content!.value + erbAttr.tag_closing!.value)
        }
        return ""
      }).join("")

      value = open_quote + attribute_value + close_quote
    }

    return name + equals + value
  }
}
