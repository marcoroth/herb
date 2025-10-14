import { ParserRule } from "../types.js"
import { ARIA_ATTRIBUTES, AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
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
      "error"
    )
  }
}

export class HTMLAriaAttributeMustBeValid extends ParserRule {
  name = "html-aria-attribute-must-be-valid"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaAttributeMustBeValid(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
