import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"
import { getTagLocalName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLOpenTagNode, HTMLAttributeNode } from "@herb-tools/core"

const UNSUPPORTED_ELEMENTS = new Set([
  "html",
  "meta",
  "script",
  "style",
])

class NoAriaUnsupportedElementsVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeNode, parentNode }: StaticAttributeStaticValueParams) {
    this.check(attributeName, attributeNode, parentNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode, parentNode }: StaticAttributeDynamicValueParams) {
    this.check(attributeName, attributeNode, parentNode)
  }

  private check(attributeName: string, attributeNode: HTMLAttributeNode, parentNode: HTMLOpenTagNode) {
    const tagName = getTagLocalName(parentNode)

    if (!tagName || !UNSUPPORTED_ELEMENTS.has(tagName)) return
    if (!attributeName.startsWith("aria-") && attributeName !== "role") return

    this.addOffense(
      `The \`${attributeName}\` attribute is not supported on the \`<${tagName}>\` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.`,
      attributeNode.location,
    )
  }
}

export class A11yNoAriaUnsupportedElementsRule extends ParserRule {
  static ruleName = "a11y-no-aria-unsupported-elements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAriaUnsupportedElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
