import { IdentityPrinter } from "./identity-printer.js"
import { PrintOptions, DEFAULT_PRINT_OPTIONS } from "./printer.js"
import { isERBOutputNode, filterNodes, ERBContentNode, isERBIfNode, isERBUnlessNode, isERBElseNode, isHTMLTextNode } from "@herb-tools/core"

import { HTMLTextNode, ERBIfNode, ERBUnlessNode, Node, HTMLAttributeValueNode } from "@herb-tools/core"

export interface ERBToRubyStringOptions extends PrintOptions {
  /**
   * Whether to force wrapping the output in double quotes even for single ERB nodes
   * @default false
   */
  forceQuotes?: boolean
}

export const DEFAULT_ERB_TO_RUBY_STRING_OPTIONS: ERBToRubyStringOptions = {
  ...DEFAULT_PRINT_OPTIONS,
  forceQuotes: false
}

/**
 * ERBToRubyStringPrinter - Converts ERB snippets to Ruby strings with interpolation
 *
 * This printer transforms ERB templates into Ruby strings by:
 * - Converting literal text to string content
 * - Converting <%= %> tags to #{} interpolation
 * - Converting simple if/else blocks to ternary operators
 * - Ignoring <% %> tags (they don't produce output)
 *
 * Examples:
 * - `hello world <%= hello %>` => `"hello world #{hello}"`
 * - `hello world <% hello %>` => `"hello world "`
 * - `Welcome <%= user.name %>!` => `"Welcome #{user.name}!"`
 * - `<% if logged_in? %>Welcome<% else %>Login<% end %>` => `"logged_in? ? "Welcome" : "Login"`
 * - `<% if logged_in? %>Welcome<% else %>Login<% end %>!` => `"#{logged_in? ? "Welcome" : "Login"}!"`
 */
export class ERBToRubyStringPrinter extends IdentityPrinter {
  static print(node: Node, options: Partial<ERBToRubyStringOptions> = DEFAULT_ERB_TO_RUBY_STRING_OPTIONS): string {
    const erbNodes = filterNodes([node], ERBContentNode)

    if (erbNodes.length === 1 && isERBOutputNode(erbNodes[0]) && !options.forceQuotes) {
      return (erbNodes[0].content?.value || "").trim()
    }

    if ('children' in node && Array.isArray(node.children)) {
      const childErbNodes = filterNodes(node.children, ERBContentNode)
      const hasOnlyERBContent = node.children.length > 0 && node.children.length === childErbNodes.length

      if (hasOnlyERBContent && childErbNodes.length === 1 && isERBOutputNode(childErbNodes[0]) && !options.forceQuotes) {
        return (childErbNodes[0].content?.value || "").trim()
      }

      const firstChild = node.children[0]

      if (node.children.length === 1 && isERBIfNode(firstChild) && !options.forceQuotes) {
        const printer = new ERBToRubyStringPrinter()

        if (printer.canConvertToTernary(firstChild)) {
          printer.convertToTernaryWithoutWrapper(firstChild)
          return printer.context.getOutput()
        }
      }

      if (node.children.length === 1 && isERBUnlessNode(firstChild) && !options.forceQuotes) {
        const printer = new ERBToRubyStringPrinter()

        if (printer.canConvertUnlessToTernary(firstChild)) {
          printer.convertUnlessToTernaryWithoutWrapper(firstChild)
          return printer.context.getOutput()
        }
      }
    }

    const printer = new ERBToRubyStringPrinter()

    printer.context.write('"')

    printer.visit(node)

    printer.context.write('"')

    return printer.context.getOutput()
  }

  visitHTMLTextNode(node: HTMLTextNode) {
    if (node.content) {
      const escapedContent = node.content.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      this.context.write(escapedContent)
    }
  }

  visitERBContentNode(node: ERBContentNode) {
    if (isERBOutputNode(node)) {
      this.context.write("#{")

      if (node.content?.value) {
        this.context.write(node.content.value.trim())
      }

      this.context.write("}")
    }
  }

  visitERBIfNode(node: ERBIfNode) {
    if (this.canConvertToTernary(node)) {
      this.convertToTernary(node)
    }
  }

  visitERBUnlessNode(node: ERBUnlessNode) {
    if (this.canConvertUnlessToTernary(node)) {
      this.convertUnlessToTernary(node)
    }
  }

  visitHTMLAttributeValueNode(node: HTMLAttributeValueNode) {
    this.visitChildNodes(node)
  }

  private canConvertToTernary(node: ERBIfNode): boolean {
    if (node.subsequent && !isERBElseNode(node.subsequent)) {
      return false
    }

    const ifOnlyText = node.statements ? node.statements.every(isHTMLTextNode) : true
    if (!ifOnlyText) return false

    if (isERBElseNode(node.subsequent)) {
      return node.subsequent.statements
        ? node.subsequent.statements.every(isHTMLTextNode)
        : true
    }

    return true
  }

  private convertToTernary(node: ERBIfNode) {
    this.context.write("#{")

    if (node.content?.value) {
      const condition = node.content.value.trim()
      const cleanCondition = condition.replace(/^if\s+/, '')
      const needsParentheses = cleanCondition.includes(' ')

      if (needsParentheses) {
        this.context.write("(")
      }

      this.context.write(cleanCondition)

      if (needsParentheses) {
        this.context.write(")")
      }
    }

    this.context.write(" ? ")
    this.context.write('"')

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write(" : ")
    this.context.write('"')

    if (isERBElseNode(node.subsequent) && node.subsequent.statements) {
      node.subsequent.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write("}")
  }

  private convertToTernaryWithoutWrapper(node: ERBIfNode) {
    if (node.subsequent && !isERBElseNode(node.subsequent)) {
      return false
    }

    if (node.content?.value) {
      const condition = node.content.value.trim()
      const cleanCondition = condition.replace(/^if\s+/, '')
      const needsParentheses = cleanCondition.includes(' ')

      if (needsParentheses) {
        this.context.write("(")
      }

      this.context.write(cleanCondition)

      if (needsParentheses) {
        this.context.write(")")
      }
    }

    this.context.write(" ? ")
    this.context.write('"')

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write(" : ")
    this.context.write('"')

    if (isERBElseNode(node.subsequent) && node.subsequent.statements) {
      node.subsequent.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
  }

  private canConvertUnlessToTernary(node: ERBUnlessNode): boolean {
    const unlessOnlyText = node.statements ? node.statements.every(isHTMLTextNode) : true

    if (!unlessOnlyText) return false

    if (isERBElseNode(node.else_clause)) {
      return node.else_clause.statements
        ? node.else_clause.statements.every(isHTMLTextNode)
        : true
    }

    return true
  }

  private convertUnlessToTernary(node: ERBUnlessNode) {
    this.context.write("#{")

    if (node.content?.value) {
      const condition = node.content.value.trim()
      const cleanCondition = condition.replace(/^unless\s+/, '')
      const needsParentheses = cleanCondition.includes(' ')

      this.context.write("!(")

      if (needsParentheses) {
        this.context.write("(")
      }

      this.context.write(cleanCondition)

      if (needsParentheses) {
        this.context.write(")")
      }

      this.context.write(")")
    }

    this.context.write(" ? ")
    this.context.write('"')

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write(" : ")
    this.context.write('"')

    if (isERBElseNode(node.else_clause)) {
      node.else_clause.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write("}")
  }

  private convertUnlessToTernaryWithoutWrapper(node: ERBUnlessNode) {
    if (node.content?.value) {
      const condition = node.content.value.trim()
      const cleanCondition = condition.replace(/^unless\s+/, '')
      const needsParentheses = cleanCondition.includes(' ')

      this.context.write("!(")

      if (needsParentheses) {
        this.context.write("(")
      }

      this.context.write(cleanCondition)

      if (needsParentheses) {
        this.context.write(")")
      }

      this.context.write(")")
    }

    this.context.write(" ? ")
    this.context.write('"')

    if (node.statements) {
      node.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
    this.context.write(" : ")
    this.context.write('"')

    if (isERBElseNode(node.else_clause)) {
      node.else_clause.statements.forEach(statement => this.visit(statement))
    }

    this.context.write('"')
  }
}
