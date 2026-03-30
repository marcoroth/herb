import { getTagLocalName, getAttributeName, isERBOpenTagNode } from "@herb-tools/core"
import type { ParseResult, ParserOptions, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import { ParserRule } from "../types.js"

const STYLESHEET_LINK_TAG_ELEMENT_SOURCE = "ActionView::Helpers::AssetTagHelper#stylesheet_link_tag"

class ERBDisallowInlineStylesVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style") {
      this.checkInlineStyle(node)
    }

    super.visitHTMLElementNode(node)
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const attributeName = getAttributeName(node)

    if (attributeName && attributeName.toLowerCase() === "style") {
      this.addOffense(
        "Avoid inline `style` attribute. Use an external stylesheet or CSS classes instead.",
        node.location,
      )
    }

    super.visitHTMLAttributeNode(node)
  }

  private checkInlineStyle(node: HTMLElementNode): void {
    if (this.isStylesheetLinkTagElement(node)) return

    this.addOffense(
      "Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.",
      node.open_tag!.location,
    )
  }

  private isStylesheetLinkTagElement(node: HTMLElementNode): boolean {
    if (!isERBOpenTagNode(node.open_tag)) return false

    return node.element_source === STYLESHEET_LINK_TAG_ELEMENT_SOURCE
  }
}

export class ERBDisallowInlineStylesRule extends ParserRule {
  static ruleName = "erb-disallow-inline-styles"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBDisallowInlineStylesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
