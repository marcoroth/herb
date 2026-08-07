import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { isVoidElement, findParent, BaseRuleVisitor } from "./rule-utils.js"
import { getTagName, getTagLocalName, isWhitespaceNode, createSyntheticToken, HTMLCloseTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, LintOffense, FullRuleConfig } from "../types.js"
import type { Node, HTMLOpenTagNode, HTMLElementNode, ParseResult, ParserOptions } from "@herb-tools/core"

interface NoSelfClosingAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLOpenTagNode>
  tagName: string
  isVoid: boolean
}

class NoSelfClosingVisitor extends BaseRuleVisitor<NoSelfClosingAutofixContext> {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "svg") {
      this.visit(node.open_tag)
    } else {
      this.visitChildNodes(node)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.tag_closing?.value === "/>") {
      const tagName = getTagName(node)
      const instead = isVoidElement(tagName) ? `<${tagName}>` : `<${tagName}></${tagName}>`

      this.addOffense(
        `Use \`${instead}\` instead of self-closing \`<${tagName} />\` for HTML compatibility.`,
        node.tag_closing.location,
        {
          node,
          tagName,
          isVoid: isVoidElement(tagName)
        }
      )
    }
  }
}

export class HTMLNoSelfClosingRule extends ParserRule<NoSelfClosingAutofixContext> {
  static autocorrectable = true
  static ruleName = "html-no-self-closing"
  static introducedIn = this.version("0.6.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/views/**/*_mailer/**/*"]
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { action_view_helpers: true }
  }

  private isIndentation(precedingNode: Node | null, node: Node): boolean {
    return !!precedingNode &&
      isWhitespaceNode(node) &&
      isWhitespaceNode(precedingNode) &&
      (precedingNode.value?.value?.includes("\n") || false)
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<NoSelfClosingAutofixContext>[] {
    const visitor = new NoSelfClosingVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<NoSelfClosingAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, tagName, isVoid } = offense.autofixContext
    const { tag_closing } = node

    if (!tag_closing) return null

    tag_closing.value = ">"

    if (node.children && Array.isArray(node.children)) {
      const children = node.children as Node[]

      if (children.length > 0) {
        const lastChild = children[children.length - 1]
        const secondToLastChild = children[children.length - 2] ?? null

        if (isWhitespaceNode(lastChild) && !this.isIndentation(secondToLastChild, lastChild)) {
          node.children = children.slice(0, -1)
        }
      }
    }

    if (!isVoid) {
      const parent = findParent(result.value, node as any as Node) as Mutable<HTMLElementNode> | null

      if (parent && parent.type === "AST_HTML_ELEMENT_NODE") {
        parent.close_tag = HTMLCloseTagNode.build({
          tag_opening: createSyntheticToken("</", "TOKEN_HTML_TAG_START_CLOSE"),
          tag_name: createSyntheticToken(tagName, "TOKEN_IDENTIFIER"),
          tag_closing: createSyntheticToken(">", "TOKEN_HTML_TAG_END"),
        })
      }
    }

    return result
  }
}
