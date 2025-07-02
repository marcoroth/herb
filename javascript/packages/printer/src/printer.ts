import {
  Visitor, Node, DocumentNode, HTMLTextNode, HTMLOpenTagNode, HTMLCloseTagNode,
  HTMLSelfCloseTagNode, HTMLElementNode, HTMLAttributeNode, HTMLAttributeValueNode,
  HTMLAttributeNameNode, HTMLCommentNode, HTMLDoctypeNode, ERBContentNode, ERBIfNode,
  ERBElseNode, ERBEndNode, ERBBlockNode, ERBCaseNode, ERBWhenNode, ERBWhileNode,
  ERBUntilNode, ERBForNode, ERBBeginNode, ERBRescueNode, ERBEnsureNode, ERBUnlessNode,
  ERBYieldNode, ERBInNode, ERBCaseMatchNode, LiteralNode
} from "@herb-tools/core"

import { PrintContext } from "./print-context.js"
import { PrinterOptions, DEFAULT_PRINTER_OPTIONS } from "./types.js"

export abstract class Printer extends Visitor {
  protected context: PrintContext
  protected options: PrinterOptions

  constructor(options: Partial<PrinterOptions> = {}) {
    super()
    this.options = { ...DEFAULT_PRINTER_OPTIONS, ...options }
    this.context = new PrintContext(this.options)
  }

  /**
   * Print a node to a string
   */
  print(node: Node): string {
    this.context.reset()
    this.visit(node)

    if (this.options.insertFinalNewline && !this.context.getOutput().endsWith('\n')) {
      this.context.newline()
    }

    return this.context.getOutput()
  }

  // Document and basic nodes
  visitDocumentNode(node: DocumentNode): void {
    this.visitChildNodes(node)
  }

  visitLiteralNode(node: LiteralNode): void {
    this.context.write(node.content)
  }

  // HTML Text handling - can be overridden by subclasses
  visitHTMLTextNode(node: HTMLTextNode): void {
    this.printTextContent(node.content)
  }

  // HTML Element nodes
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.context.write("<")
    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }
    this.visitChildNodes(node)
    this.context.write(">")
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.context.write("</")
    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }
    this.context.write(">")
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.context.write("<")
    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }
    if (node.attributes) {
      node.attributes.forEach(attr => this.visit(attr))
    }
    const closeStyle = this.options.selfClosingTagStyle || '/>'
    this.context.write(closeStyle === '/>' ? ' />' : '>')
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = node.tag_name?.value
    if (tagName) {
      this.context.enterTag(tagName)
    }

    if (node.open_tag) {
      this.visit(node.open_tag)
    }
    if (node.body) {
      node.body.forEach(child => this.visit(child))
    }
    if (node.close_tag) {
      this.visit(node.close_tag)
    }

    if (tagName) {
      this.context.exitTag()
    }
  }

  // HTML Attributes
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    this.context.write(" ")
    if (node.name) {
      this.visit(node.name)
    }
    if (node.equals && node.value) {
      this.context.write("=")
      this.visit(node.value)
    }
  }

  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    if (node.name) {
      this.context.write(node.name.value)
    }
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode): void {
    if (node.quoted && node.open_quote) {
      this.context.write(node.open_quote.value)
    }
    this.visitChildNodes(node)
    if (node.quoted && node.close_quote) {
      this.context.write(node.close_quote.value)
    }
  }

  // HTML Comments and Doctype
  visitHTMLCommentNode(node: HTMLCommentNode): void {
    this.context.write("<!--")
    this.visitChildNodes(node)
    this.context.write("-->")
  }

  visitHTMLDoctypeNode(node: HTMLDoctypeNode): void {
    this.context.write(node.tag_opening!.value)
    this.visitChildNodes(node)
    this.context.write(node.tag_closing!.value)
  }

  // ERB nodes - all delegate to printERBNode for consistency
  visitERBContentNode(node: ERBContentNode): void {
    this.printERBNode(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.subsequent) {
      this.visit(node.subsequent)
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.printERBNode(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.printERBNode(node)
    if (node.body) {
      node.body.forEach(child => this.visit(child))
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBCaseNode(node: ERBCaseNode): void {
    this.printERBNode(node)
    if (node.conditions) {
      node.conditions.forEach(condition => this.visit(condition))
    }
    if (node.else_clause) {
      this.visit(node.else_clause)
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBForNode(node: ERBForNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.rescue_clause) {
      this.visit(node.rescue_clause)
    }
    if (node.else_clause) {
      this.visit(node.else_clause)
    }
    if (node.ensure_clause) {
      this.visit(node.ensure_clause)
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.subsequent) {
      this.visit(node.subsequent)
    }
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
    if (node.else_clause) {
      this.visit(node.else_clause)
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBYieldNode(node: ERBYieldNode): void {
    this.printERBNode(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.printERBNode(node)
    if (node.statements) {
      node.statements.forEach(stmt => this.visit(stmt))
    }
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.printERBNode(node)
    if (node.conditions) {
      node.conditions.forEach(condition => this.visit(condition))
    }
    if (node.else_clause) {
      this.visit(node.else_clause)
    }
    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  // Protected helper methods that can be overridden by subclasses

  /**
   * Print ERB node tags and content
   */
  protected printERBNode(node: any): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }
    if (node.content) {
      const spacing = this.options.erbTagSpacing === 'spaced' ? ' ' : ''
      if (spacing && node.tag_opening?.value && !node.content.value.startsWith(' ')) {
        this.context.write(spacing)
      }
      this.context.write(node.content.value)
      if (spacing && node.tag_closing?.value && !node.content.value.endsWith(' ')) {
        this.context.write(spacing)
      }
    }
    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }

  /**
   * Print text content - can be overridden for minification/formatting
   */
  protected printTextContent(content: string): void {
    this.context.write(content)
  }
}
