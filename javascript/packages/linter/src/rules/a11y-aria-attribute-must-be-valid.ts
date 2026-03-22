import { ParserRule } from "../types.js"
import { ARIA_ATTRIBUTES, AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class AriaAttributeMustBeValid extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.check(attributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    this.check(attributeName, attributeNode)
  }

  private check(attributeName: string, attributeNode: HTMLAttributeNode) {
    if (!attributeName.startsWith("aria-")) return
    if (ARIA_ATTRIBUTES.has(attributeName)) return

    this.addOffense(
      `The attribute \`${attributeName}\` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.`,
      attributeNode.location,
    )
  }
}

export class A11yAriaAttributeMustBeValid extends ParserRule {
  static ruleName = "a11y-aria-attribute-must-be-valid"
  static introducedIn = this.version("0.4.1")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AriaAttributeMustBeValid(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
