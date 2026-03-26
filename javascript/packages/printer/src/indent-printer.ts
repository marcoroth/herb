import { IdentityPrinter } from "./identity-printer.js"

import type * as Nodes from "@herb-tools/core"

/**
 * IndentPrinter - Re-indentation printer that preserves content but adjusts indentation
 *
 * Extends IdentityPrinter to preserve all content as-is while replacing
 * leading whitespace on each line with the correct indentation based on
 * the AST nesting depth.
 */
export class IndentPrinter extends IdentityPrinter {
  protected indentLevel: number = 0
  protected indentWidth: number
  private pendingIndent: boolean = false

  constructor(indentWidth: number = 2) {
    super()

    this.indentWidth = indentWidth
  }

  protected get indent(): string {
    return " ".repeat(this.indentLevel * this.indentWidth)
  }

  protected write(content: string): void {
    if (this.pendingIndent && content.length > 0) {
      this.pendingIndent = false
      this.context.write(this.indent + content)
    } else {
      this.context.write(content)
    }
  }

  visitLiteralNode(node: Nodes.LiteralNode): void {
    this.writeWithIndent(node.content)
  }

  visitHTMLTextNode(node: Nodes.HTMLTextNode): void {
    this.writeWithIndent(node.content)
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
      this.indentLevel++
      node.body.forEach(child => this.visit(child))
      this.indentLevel--
    }

    if (node.close_tag) {
      this.visit(node.close_tag)
    }

    if (tagName) {
      this.context.exitTag()
    }
  }

  visitERBIfNode(node: Nodes.ERBIfNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
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
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }
  }

  visitERBBlockNode(node: Nodes.ERBBlockNode): void {
    this.printERBNode(node)

    if (node.body) {
      this.indentLevel++
      node.body.forEach(child => this.visit(child))
      this.indentLevel--
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

  visitERBCaseNode(node: Nodes.ERBCaseNode): void {
    this.printERBNode(node)

    if (node.children) {
      this.indentLevel++
      node.children.forEach(child => this.visit(child))
      this.indentLevel--
    }

    if (node.conditions) {
      this.indentLevel++
      node.conditions.forEach(condition => this.visit(condition))
      this.indentLevel--
    }

    if (node.else_clause) {
      this.indentLevel++
      this.visit(node.else_clause)
      this.indentLevel--
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBWhenNode(node: Nodes.ERBWhenNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }
  }

  visitERBWhileNode(node: Nodes.ERBWhileNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBUntilNode(node: Nodes.ERBUntilNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBForNode(node: Nodes.ERBForNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  visitERBBeginNode(node: Nodes.ERBBeginNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
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
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }

    if (node.subsequent) {
      this.visit(node.subsequent)
    }
  }

  visitERBEnsureNode(node: Nodes.ERBEnsureNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }
  }

  visitERBUnlessNode(node: Nodes.ERBUnlessNode): void {
    this.printERBNode(node)

    if (node.statements) {
      this.indentLevel++
      node.statements.forEach(statement => this.visit(statement))
      this.indentLevel--
    }

    if (node.else_clause) {
      this.visit(node.else_clause)
    }

    if (node.end_node) {
      this.visit(node.end_node)
    }
  }

  /**
   * Write content, replacing leading whitespace on each line with the current indent.
   *
   * Uses a pendingIndent mechanism: when content ends with a newline followed by
   * whitespace-only, sets pendingIndent=true instead of writing the indent immediately.
   * The indent is then applied at the correct level when the next node writes content
   * (via the overridden write() method).
   */
  protected writeWithIndent(content: string): void {
    if (!content.includes("\n")) {
      if (this.pendingIndent) {
        this.pendingIndent = false

        const trimmed = content.replace(/^[ \t]+/, "")

        if (trimmed.length > 0) {
          this.context.write(this.indent + trimmed)
        }
      } else {
        this.context.write(content)
      }

      return
    }

    const lines = content.split("\n")
    const lastIndex = lines.length - 1

    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        this.context.write("\n")
      }

      const line = lines[i]
      const trimmed = line.replace(/^[ \t]+/, "")

      if (i === 0) {
        if (this.pendingIndent) {
          this.pendingIndent = false

          if (trimmed.length > 0) {
            this.context.write(this.indent + trimmed)
          }
        } else {
          this.context.write(line)
        }
      } else if (i === lastIndex && trimmed.length === 0) {
        this.pendingIndent = true
      } else if (trimmed.length === 0) {
        // Middle whitespace-only line: write nothing (newline already written above)
      } else {
        this.context.write(this.indent + trimmed)
      }
    }
  }
}
