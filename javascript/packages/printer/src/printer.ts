import { Node, Visitor } from "@herb-tools/core"
import { PrintContext } from "./print-context.js"

import type * as Nodes from "@herb-tools/core"

/**
 * Options for controlling the printing behavior
 */
export type PrintOptions = {
  /**
   * When true, allows printing nodes that have parse errors.
   * When false (default), throws an error if attempting to print nodes with errors.
   * @default false
   */
  ignoreErrors: boolean
}

/**
 * Default print options used when none are provided
 */
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  ignoreErrors: false
}

export abstract class Printer extends Visitor {
  protected context: PrintContext = new PrintContext()

  /**
   * Print a node to a string
   * 
   * @param node - The AST node to print
   * @param options - Print options to control behavior
   * @returns The printed string representation of the node
   * @throws {Error} When node has parse errors and ignoreErrors is false
   */
  print(node: Node, options: PrintOptions = DEFAULT_PRINT_OPTIONS): string {
    if (options.ignoreErrors === false && node.recursiveErrors().length > 0) {
      throw new Error(`Cannot print the node (${node.type}) since it or any of its children has parse errors. Either pass in a valid Node or call \`print()\` using \`print(node, { ignoreErrors: true })\``)
    }

    this.context.reset()
    this.visit(node)

    return this.context.getOutput()
  }

  visitDocumentNode(node: Nodes.DocumentNode): void {
    this.visitChildNodes(node)
  }

  visitLiteralNode(node: Nodes.LiteralNode): void {
    this.context.write(node.content)
  }

  visitHTMLTextNode(node: Nodes.HTMLTextNode): void {
    this.write(node.content)
  }

  visitWhitespaceNode(node: Nodes.WhitespaceNode): void {
    if (node.value) {
      this.write(node.value.value)
    }
  }

  visitHTMLOpenTagNode(node: Nodes.HTMLOpenTagNode): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }

    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }

  visitHTMLCloseTagNode(node: Nodes.HTMLCloseTagNode): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }

    if (node.tag_name) {
      this.context.write(node.tag_name.value)
    }

    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }

  visitHTMLElementNode(node: Nodes.HTMLElementNode): void {
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

  visitHTMLAttributeNode(node: Nodes.HTMLAttributeNode): void {
    if (node.name) {
      this.visit(node.name)
    }

    if (node.equals) {
      this.context.write(node.equals.value)
    }

    if (node.equals && node.value) {
      this.visit(node.value)
    }
  }

  visitHTMLAttributeNameNode(node: Nodes.HTMLAttributeNameNode): void {
    this.visitChildNodes(node)
  }

  visitHTMLAttributeValueNode(node: Nodes.HTMLAttributeValueNode): void {
    if (node.quoted && node.open_quote) {
      this.context.write(node.open_quote.value)
    }

    this.visitChildNodes(node)

    if (node.quoted && node.close_quote) {
      this.context.write(node.close_quote.value)
    }
  }

  visitHTMLCommentNode(node: Nodes.HTMLCommentNode): void {
    if (node.comment_start) {
      this.context.write(node.comment_start.value)
    }

    this.visitChildNodes(node)

    if (node.comment_end) {
      this.context.write(node.comment_end.value)
    }
  }

  visitHTMLDoctypeNode(node: Nodes.HTMLDoctypeNode): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
  }

  visitERBContentNode(node: Nodes.ERBContentNode): void {
    this.printERBNode(node)
  }

  visitERBIfNode(node: Nodes.ERBIfNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.subsequent) {
      this.visit(node.subsequent)
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBElseNode(node: Nodes.ERBElseNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }
  }

  visitERBEndNode(node: Nodes.ERBEndNode): void {
    this.printERBNode(node)
  }

  visitERBBlockNode(node: Nodes.ERBBlockNode): void {
    this.printERBNode(node)

    if (node.body) {
      node.body.forEach(child => this.visit(child))
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBCaseNode(node: Nodes.ERBCaseNode): void {
    this.printERBNode(node)

    if (node.children) {
      node.children.forEach(child => this.visit(child))
    }

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

  visitERBWhenNode(node: Nodes.ERBWhenNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }
  }

  visitERBWhileNode(node: Nodes.ERBWhileNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBUntilNode(node: Nodes.ERBUntilNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBForNode(node: Nodes.ERBForNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: Nodes.ERBBeginNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
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

  visitERBRescueNode(node: Nodes.ERBRescueNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.subsequent) {
      this.visit(node.subsequent)
    }
  }

  visitERBEnsureNode(node: Nodes.ERBEnsureNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }
  }

  visitERBUnlessNode(node: Nodes.ERBUnlessNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    if (node.else_clause) {
      this.visit(node.else_clause)
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBYieldNode(node: Nodes.ERBYieldNode): void {
    this.printERBNode(node)
  }

  visitERBInNode(node: Nodes.ERBInNode): void {
    this.printERBNode(node)

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }
  }

  visitERBCaseMatchNode(node: Nodes.ERBCaseMatchNode): void {
    this.printERBNode(node)

    if (node.children) {
      node.children.forEach(child => this.visit(child))
    }

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

  /**
   * Print ERB node tags and content
   */
  protected printERBNode(node: Nodes.ERBNode): void {
    if (node.tag_opening) {
      this.context.write(node.tag_opening.value)
    }

    if (node.content) {
      this.context.write(node.content.value)
    }

    if (node.tag_closing) {
      this.context.write(node.tag_closing.value)
    }
   }

  protected write(content: string): void {
    this.context.write(content)
  }
}
