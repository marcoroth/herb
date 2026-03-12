import { BaseRuleVisitor } from "./rule-utils.js"
import { getAttribute, getStaticAttributeValue, getTagLocalName, isERBOpenTagNode, isHTMLOpenTagNode, isRubyLiteralNode, filterHTMLAttributeNodes, findAttributeByName } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLAttributeNode, ParseResult, ParserOptions } from "@herb-tools/core"

class AnchorRequireHrefVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkATag(node)
    super.visitHTMLElementNode(node)
  }

  private checkATag(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "a") {
      return
    }

    const hrefAttribute = this.getHrefAttribute(node)

    if (!hrefAttribute) {
      this.addOffense(
        "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.",
        node.tag_name!.location,
      )

      return
    }

    const hrefValue = getStaticAttributeValue(hrefAttribute)

    if (hrefValue === "#") {
      this.addOffense(
        'Avoid `href="#"` on `<a>`. `href="#"` does not navigate anywhere, scrolls the page to the top, and adds `#` to the URL. If you need a clickable element without navigation, use a `<button>` instead.',
        hrefAttribute.location,
      )

      return
    }

    if (hrefValue !== null && hrefValue.startsWith("javascript:void")) {
      this.addOffense(
        'Avoid `javascript:void(0)` in `href` on `<a>`. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.',
        hrefAttribute.location,
      )

      return
    }

    if (this.hasNilHrefValue(hrefAttribute)) {
      this.addOffense(
        "Avoid passing `nil` as the URL for `link_to`. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead.",
        hrefAttribute.location,
      )
    }
  }

  private hasNilHrefValue(hrefAttribute: HTMLAttributeNode): boolean {
    const valueNode = hrefAttribute.value

    if (!valueNode) return false

    return valueNode.children.some(child =>
      isRubyLiteralNode(child) && child.content === "url_for(nil)"
    )
  }

  private getHrefAttribute(node: HTMLElementNode): HTMLAttributeNode | null {
    const openTag = node.open_tag

    if (isHTMLOpenTagNode(openTag)) {
      return getAttribute(openTag, "href")
    }

    if (isERBOpenTagNode(openTag)) {
      return findAttributeByName(filterHTMLAttributeNodes(openTag.children), "href")
    }

    return null
  }
}

export class HTMLAnchorRequireHrefRule extends ParserRule {
  static ruleName = "html-anchor-require-href"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AnchorRequireHrefVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
