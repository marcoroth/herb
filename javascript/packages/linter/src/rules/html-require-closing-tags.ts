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

    const textNode = this.findLastTextNode(parentElement)
    if (!textNode) return null

    const content = textNode.content
    // capture newline and leading whitespace of the next line
    // e.g. "Item 1\n  "  →  "Item 1</li>\n  "
    const match = content.match(/(\n\s*)$/)
    if (match) {
      textNode.content = content.slice(0, -match[1].length) + closeTag + match[1]
    } else {
      textNode.content = content + closeTag
    }

    return result
  }

  private findLastTextNode(node: Mutable<HTMLElementNode>): Mutable<HTMLTextNode> | null {
    if (node.body.length === 0) return null

    const last = node.body[node.body.length - 1]
    if (last.type === "AST_HTML_TEXT_NODE") return last as Mutable<HTMLTextNode>
    if (last.type === "AST_HTML_ELEMENT_NODE") return this.findLastTextNode(last as Mutable<HTMLElementNode>)

    return null
  }
}
