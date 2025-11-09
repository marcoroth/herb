import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { isVoidElement, findParent, BaseRuleVisitor } from "./rule-utils.js"
import { getTagName, isWhitespaceNode, Location, HTMLCloseTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, LintOffense, FullRuleConfig } from "../types.js"
import type { Node, HTMLOpenTagNode, HTMLElementNode, SerializedToken, ParseResult } from "@herb-tools/core"

interface NoSelfClosingAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLOpenTagNode>
  tagName: string
  isVoid: boolean
}

class NoSelfClosingVisitor extends BaseRuleVisitor<NoSelfClosingAutofixContext> {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagName(node) === "svg") {
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
        node.location,
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
  name = "html-no-self-closing"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/views/**/*_mailer/**/*"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<NoSelfClosingAutofixContext>[] {
    const visitor = new NoSelfClosingVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<NoSelfClosingAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, tagName, isVoid } = offense.autofixContext
    const { tag_closing } = node

    if (!tag_closing) return null

    tag_closing.value = ">"

    if (node.children && Array.isArray(node.children)) {
      const children = node.children as Node[]

      if (children.length > 0 && isWhitespaceNode(children[children.length - 1])) {
        node.children = children.slice(0, -1)
      }
    }

    if (!isVoid) {
      const parent = findParent(result.value, node as any as Node) as Mutable<HTMLElementNode> | null

      if (parent && parent.type === "AST_HTML_ELEMENT_NODE") {
        const tag_opening: SerializedToken = { type: "TOKEN_HTML_TAG_START_CLOSE", value: "</", location: Location.zero, range: [0, 0] }
        const tag_name: SerializedToken = { type: "TOKEN_IDENTIFIER", value: tagName, location: Location.zero, range: [0, 0] }
        const tag_closing: SerializedToken = { type: "TOKEN_HTML_TAG_END", value: ">", location: Location.zero, range: [0, 0] }

        parent.close_tag = HTMLCloseTagNode.from({
          type: "AST_HTML_CLOSE_TAG_NODE",
          tag_opening,
          tag_name,
          tag_closing,
          children: [],
          errors: [],
          location: Location.zero,
        })
      }
    }

    return result
  }
}
