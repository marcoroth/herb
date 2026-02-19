import type { HTMLOmittedCloseTagNode, HTMLElementNode, HTMLTextNode, Node, ParseResult } from "@herb-tools/core"

import { BaseRuleVisitor, findParent } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface RequireClosingTagsAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLOmittedCloseTagNode>
}

class RequireClosingTagsVisitor extends BaseRuleVisitor<RequireClosingTagsAutofixContext> {
  visitHTMLOmittedCloseTagNode(node: HTMLOmittedCloseTagNode): void {
    const tagName = node.tag_name?.value
    if (!tagName) return

    this.addOffense(
      `Missing explicit closing tag for \`<${tagName}>\`. Use \`</${tagName}>\` instead of relying on implicit tag closing.`,
      node.location,
      { node: node as Mutable<HTMLOmittedCloseTagNode> }
    )
  }
}

export class HTMLRequireClosingTagsRule extends ParserRule<RequireClosingTagsAutofixContext> {
  static autocorrectable = true
  name = "html-require-closing-tags"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      parserOptions: { strict: false }
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<RequireClosingTagsAutofixContext>[] {
    const visitor = new RequireClosingTagsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<RequireClosingTagsAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    const tagName = node.tag_name?.value
    if (!tagName) return null

    const closeTag = `</${tagName}>`

    // Find the parent element of the omitted close tag node
    const parentElement = findParent(result.value, node as unknown as Node) as Mutable<HTMLElementNode> | null
    if (!parentElement) return null

    const textNode = this.findTextLeaf(parentElement)
    if (!textNode) return null

    // Insert before trailing newline + indentation, e.g. "Item 1\n  " → "Item 1</li>\n  "
    // For element children with trailing whitespace (e.g. <thead> containing <tr>),
    // place the closing tag on its own indented line.
    const lastBodyNode = parentElement.body[parentElement.body.length - 1]
    const content = textNode.content
    const match = content.match(/(\n\s*)$/)
    const insertion = (match && lastBodyNode.type === "AST_HTML_ELEMENT_NODE")
      ? "\n" + " ".repeat(parentElement.location.start.column) + closeTag
      : closeTag

    if (match) {
      textNode.content = content.slice(0, -match[1].length) + insertion + match[1]
    } else {
      textNode.content = content + insertion
    }

    // Remove error so file can be printed without `ignoreErrors`
    parentElement.errors = parentElement.errors.filter(e => e.type !== "OMITTED_CLOSING_TAG_ERROR")

    return result
  }

  private findTextLeaf(node: Mutable<HTMLElementNode>): Mutable<HTMLTextNode> | null {
    if (!node.body.length) return null

    const last = node.body[node.body.length - 1]
    if (last.type === "AST_HTML_TEXT_NODE") return last as Mutable<HTMLTextNode>
    if (last.type === "AST_HTML_ELEMENT_NODE") return this.findTextLeaf(last as Mutable<HTMLElementNode>)

    return null
  }
}
