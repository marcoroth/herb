import type { ParseResult, ParserOptions, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"
import { getTagLocalName, getAttributeName, isERBOpenTagNode, isHTMLOpenTagNode, filterHTMLAttributeNodes } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const UNSUPPORTED_ELEMENTS = new Set([
  "html",
  "meta",
  "script",
  "style",
])

class NoAriaUnsupportedElementsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName && UNSUPPORTED_ELEMENTS.has(tagName)) {
      this.checkAttributes(node, tagName)
    }

    super.visitHTMLElementNode(node)
  }

  private checkAttributes(node: HTMLElementNode, tagName: string): void {
    const attributes = this.getAttributeNodes(node)

    for (const attributeNode of attributes) {
      const attributeName = getAttributeName(attributeNode)
      if (!attributeName) continue
      if (!attributeName.startsWith("aria-") && attributeName !== "role") continue

      this.addOffense(
        `The \`${attributeName}\` attribute is not supported on the \`<${tagName}>\` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.`,
        attributeNode.location,
      )
    }
  }

  private getAttributeNodes(node: HTMLElementNode): HTMLAttributeNode[] {
    const openTag = node.open_tag

    if (isERBOpenTagNode(openTag)) {
      return filterHTMLAttributeNodes(openTag.children)
    } else if (isHTMLOpenTagNode(openTag)) {
      return filterHTMLAttributeNodes(openTag.children)
    } else {
      return []
    }
  }
}

export class A11yNoAriaUnsupportedElementsRule extends ParserRule {
  static ruleName = "a11y-no-aria-unsupported-elements"
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
    const visitor = new NoAriaUnsupportedElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
