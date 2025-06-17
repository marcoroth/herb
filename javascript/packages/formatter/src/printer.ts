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

import type { FormatOptions } from "./options"

/**
 * Printer is responsible for traversing the Herb AST
 * and emitting a formatted string with proper indentation,
 * line breaks for long lines, and wrapping HTML attributes.
 */
export class Printer {
  private options: Required<FormatOptions>
  private source: string

  constructor(source: string, options: Required<FormatOptions>) {
    this.source = source
    this.options = options
  }

  print(node: DocumentNode): string {
    const lines: string[] = []

    for (const child of node.children) {
      lines.push(this.printNode(child, 0))
    }

    return lines.filter(Boolean).join("\n")
  }

  private printNode(node: Node, indentLevel: number): string {
    console.log("printNode", node.type)

    if (node instanceof HTMLElementNode) {
      return this.printElement(node, indentLevel)
    } else if (node instanceof HTMLOpenTagNode) {
      return this.printOpenTag(node, indentLevel)
    } else if (node instanceof HTMLSelfCloseTagNode) {
      return this.printSelfCloseTag(node, indentLevel)
    } else if (node instanceof HTMLCloseTagNode) {
      return this.printCloseTag(node, indentLevel)
    } else if (node instanceof HTMLTextNode) {
      return this.printText(node, indentLevel)
    } else if (node instanceof HTMLCommentNode) {
      return this.printComment(node, indentLevel)
    } else if (node instanceof HTMLDoctypeNode) {
      return this.printDoctype(node, indentLevel)
    } else if (node instanceof ERBBeginNode) {
      return this.printERBBegin(node, indentLevel)
    } else if (node instanceof ERBBlockNode) {
      return this.printERBBlock(node, indentLevel)
    } else if (node instanceof ERBIfNode) {
      return this.printERBIf(node, indentLevel)
    } else if (node instanceof ERBElseNode) {
      return this.printERBElse(node, indentLevel)
    } else if (node instanceof ERBEndNode || node instanceof ERBContentNode) {
      return this.printERBRaw(node, indentLevel)
    } else if (node instanceof ERBWhenNode) {
      return this.printERBWhen(node, indentLevel)
    } else if (node instanceof ERBCaseNode) {
      return this.printERBCase(node, indentLevel)
    } else if (node instanceof ERBCaseMatchNode) {
      return this.printERBRaw(node, indentLevel)
    } else if (
      node instanceof ERBWhileNode ||
      node instanceof ERBUntilNode ||
      node instanceof ERBForNode
    ) {
      return this.printERBGeneric(node, indentLevel)
    } else if (
      node instanceof ERBRescueNode ||
      node instanceof ERBEnsureNode ||
      node instanceof ERBUnlessNode
    ) {
      return this.printERBGeneric(node, indentLevel)
    } else if (node instanceof ERBYieldNode || node instanceof ERBInNode) {
      return this.printERBRaw(node, indentLevel)
    } else if (node instanceof WhitespaceNode) {
      return ""
    } else {
      return this.raw(node, indentLevel)
    }
  }

  private printElement(node: HTMLElementNode, indentLevel: number): string {
    const open = node.open_tag as HTMLOpenTagNode
    const tagName = open.tag_name?.value ?? ""
    const indent = this.indent(indentLevel)
    const attributes = open.children.filter(
      (child): child is HTMLAttributeNode => child instanceof HTMLAttributeNode,
    )
    const children = node.body.filter(
      child =>
        !(child instanceof WhitespaceNode) &&
        !(child instanceof HTMLTextNode && child.content.trim() === ""),
    )

    if (attributes.length === 0) {
      if (children.length === 0) {
        const single = `<${tagName}${node.is_void ? ' /' : ''}>${node.is_void ? '' : `</${tagName}>`}`
        return indent + single
      }

      const lines: string[] = []

      lines.push(indent + `<${tagName}>`)

      for (const child of children) {
        lines.push(this.printNode(child, indentLevel + 1))
      }

      if (!node.is_void) {
        lines.push(indent + `</${tagName}>`)
      }

      return lines.join("\n")
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
      inline.length + indent.length <= this.options.maxLineLength
    ) {
      if (children.length === 0) {
        return (
          indent + `<${tagName} ${this.renderAttribute(attributes[0])}></${tagName}>`
        )
      }

      const lines = [indent + inline]

      for (const child of children) {
        lines.push(this.printNode(child, indentLevel + 1))
      }

      if (!node.is_void) {
        lines.push(indent + `</${tagName}>`)
      }

      return lines.join("\n")
    }

    const lines: string[] = []

    lines.push(indent + `<${tagName}`)

    for (const attribute of attributes) {
      lines.push(this.indent(indentLevel + 1) + this.renderAttribute(attribute))
    }

    if (node.is_void) {
      lines.push(indent + "/>" )
    } else if (children.length === 0) {
      lines.push(indent + ">" + `</${tagName}>`)
    } else {
      lines.push(indent + ">")

      for (const child of children) {
        lines.push(this.printNode(child, indentLevel + 1))
      }

      lines.push(indent + `</${tagName}>`)
    }

    return lines.join("\n")
  }

  private printOpenTag(node: HTMLOpenTagNode, indentLevel: number): string {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent(indentLevel)
    const attributes = node.children.filter((attribute): attribute is HTMLAttributeNode => attribute instanceof HTMLAttributeNode)
    const inline = this.renderInlineOpen(tagName, attributes, node.is_void)

    if (attributes.length === 0 || inline.length + indent.length <= this.options.maxLineLength) {
      return indent + inline
    }

    const lines: string[] = []

    lines.push(indent + `<${tagName}`)

    for (const attribute of attributes) {
      lines.push(this.indent(indentLevel + 1) + this.renderAttribute(attribute))
    }

    lines.push(indent + (node.is_void ? "/>" : ">"))

    return lines.join("\n")
  }

  private printSelfCloseTag(node: HTMLSelfCloseTagNode, indentLevel: number): string {
    const tagName = node.tag_name?.value ?? ""
    const indent = this.indent(indentLevel)
    const attributes = node.attributes.filter((attribute): attribute is HTMLAttributeNode => attribute instanceof HTMLAttributeNode)
    const inline = this.renderInlineOpen(tagName, attributes, true)

    if (attributes.length === 0 || inline.length + indent.length <= this.options.maxLineLength) {
      return indent + inline
    }

    const lines: string[] = []

    lines.push(indent + `<${tagName}`)

    for (const attribute of attributes) {
      lines.push(this.indent(indentLevel + 1) + this.renderAttribute(attribute))
    }

    lines.push(indent + "/>" )

    return lines.join("\n")
  }

  private printCloseTag(node: HTMLCloseTagNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const name = node.tag_name?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    return indent + open + name + close
  }

  private printText(node: HTMLTextNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    let text = node.content.trim()
    console.log("printText", text)
    if (!text) return ""

    const wrapWidth = this.options.maxLineLength - indent.length
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

    return lines.join("\n")
  }

  private printComment(node: HTMLCommentNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.comment_start?.value ?? ""
    const close = node.comment_end?.value ?? ""
    let inner: string

    if (node.comment_start && node.comment_end) {
      // TODO: use .value
      const [_, startIndex] = node.comment_start.range.toArray()
      const [endIndex] = node.comment_end.range.toArray()
      inner = this.source.slice(startIndex, endIndex)
    } else {
      inner = node.children.map(child => this.printNode(child, 0)).join("")
    }

    return indent + open + inner + close
  }

  private printDoctype(node: HTMLDoctypeNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
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
          child instanceof HTMLTextNode ? child.content : this.printNode(child, 0),
        )
        .join("")
    }

    const close = node.tag_closing?.value ?? ""

    return indent + open + innerDoctype + close
  }

  private printERBRaw(
    node: ERBEndNode | ERBContentNode | ERBYieldNode | ERBInNode | ERBCaseMatchNode,
    indentLevel: number,
  ): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""

    return indent + open + content + close
  }

  private printERBBlock(node: ERBBlockNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const child of node.body) {
      const printed = this.printNode(child, indentLevel + 1)
      if (printed) lines.push(printed)
    }

    if (node.end_node) {
      lines.push(this.printNode(node.end_node, indentLevel))
    }

    return lines.join("\n")
  }

  private printERBIf(node: ERBIfNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const child of node.statements) {
      lines.push(this.printNode(child, indentLevel + 1))
    }

    if (node.subsequent) {
      lines.push(this.printNode(node.subsequent, indentLevel))
    }

    if (node.end_node) {
      lines.push(this.printNode(node.end_node, indentLevel))
    }

    return lines.join("\n")
  }

  private printERBElse(node: ERBElseNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const child of node.statements) {
      lines.push(this.printNode(child, indentLevel + 1))
    }

    return lines.join("\n")
  }

  private printERBWhen(node: ERBWhenNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const stmt of node.statements) {
      lines.push(this.printNode(stmt, indentLevel + 1))
    }

    return lines.join("\n")
  }

  private printERBCase(node: ERBCaseNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const cond of node.conditions) {
      lines.push(this.printNode(cond, indentLevel + 1))
    }

    if (node.else_clause) {
      lines.push(this.printNode(node.else_clause, indentLevel + 1))
    }

    if (node.end_node) {
      lines.push(this.printNode(node.end_node, indentLevel))
    }

    return lines.join("\n")
  }

  private printERBBegin(node: ERBBeginNode, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    for (const stmt of node.statements) {
      const printed = this.printNode(stmt, indentLevel + 1)
      if (printed) lines.push(printed)
    }

    if (node.rescue_clause) {
      const printed = this.printNode(node.rescue_clause, indentLevel)
      if (printed) lines.push(printed)
    }

    if (node.else_clause) {
      const printed = this.printNode(node.else_clause, indentLevel)
      if (printed) lines.push(printed)
    }

    if (node.ensure_clause) {
      const printed = this.printNode(node.ensure_clause, indentLevel)
      if (printed) lines.push(printed)
    }

    if (node.end_node) {
      const printed = this.printNode(node.end_node, indentLevel)
      if (printed) lines.push(printed)
    }

    return lines.join("\n")
  }

  private printERBGeneric(node: Node, indentLevel: number): string {
    const indent = this.indent(indentLevel)
    const open = node.tag_opening?.value ?? ""
    const content = node.content?.value ?? ""
    const close = node.tag_closing?.value ?? ""
    const lines: string[] = []

    lines.push(indent + open + content + close)

    const statements: any[] = node.statements ?? node.body ?? node.children ?? []

    for (const statement of statements) {
      const printed = this.printNode(statement, indentLevel + 1)
      if (printed) lines.push(printed)
    }

    if (node.end_node) {
      const printed = this.printNode(node.end_node, indentLevel)
      if (printed) lines.push(printed)
    }

    return lines.join("\n")
  }

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

  private raw(node: Node, indentLevel: number): string {
    if (node.tag_opening && node.tag_closing) {
      return this.printNode(node, indentLevel)
    }

    return ""
  }

  private indent(level: number): string {
    return " ".repeat(level * this.options.indentWidth)
  }
}
