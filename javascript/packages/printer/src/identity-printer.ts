import { Printer } from "./printer.js"
import { getNodesBeforePosition, getNodesAfterPosition } from "@herb-tools/core"

import type * as Nodes from "@herb-tools/core"

/**
 * IdentityPrinter - Provides lossless reconstruction of the original source
 *
 * This printer aims to reconstruct the original input as faithfully as possible,
 * preserving all whitespace, formatting, and structure. It's useful for:
 * - Testing parser accuracy (input should equal output)
 * - Baseline printing before applying transformations
 * - Verifying AST round-trip fidelity
 */
export class IdentityPrinter extends Printer {
  static printERBNode(node: Nodes.ERBNode) {
    const printer = new IdentityPrinter()

    printer.printERBNode(node)

    return printer.context.getOutput()
  }

  visitLiteralNode(node: Nodes.LiteralNode): void {
    this.write(node.content)
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
      this.write(node.tag_opening.value)
    }

    if (node.tag_name) {
      this.write(node.tag_name.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
    }
  }

  visitHTMLCloseTagNode(node: Nodes.HTMLCloseTagNode): void {
    if (node.tag_opening) {
      this.write(node.tag_opening.value)
    }

    if (node.tag_name) {
      const before = getNodesBeforePosition(node.children, node.tag_name.location.start, true)
      const after = getNodesAfterPosition(node.children, node.tag_name.location.end)

      this.visitAll(before)
      this.write(node.tag_name.value)
      this.visitAll(after)
    } else {
      this.visitAll(node.children)
    }

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
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
      this.write(node.equals.value)
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
      this.write(node.open_quote.value)
    }

    this.visitChildNodes(node)

    if (node.quoted && node.close_quote) {
      this.write(node.close_quote.value)
    }
  }

  visitHTMLCommentNode(node: Nodes.HTMLCommentNode): void {
    if (node.comment_start) {
      this.write(node.comment_start.value)
    }

    this.visitChildNodes(node)

    if (node.comment_end) {
      this.write(node.comment_end.value)
    }
  }

  visitHTMLDoctypeNode(node: Nodes.HTMLDoctypeNode): void {
    if (node.tag_opening) {
      this.write(node.tag_opening.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
    }
  }

  visitXMLDeclarationNode(node: Nodes.XMLDeclarationNode): void {
    if (node.tag_opening) {
      this.write(node.tag_opening.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
    }
  }

  visitCDATANode(node: Nodes.CDATANode): void {
    if (node.tag_opening) {
      this.write(node.tag_opening.value)
    }

    this.visitChildNodes(node)

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
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
      this.write(node.tag_opening.value)
    }

    if (node.content) {
      this.write(node.content.value)
    }

    if (node.tag_closing) {
      this.write(node.tag_closing.value)
    }
   }
}
