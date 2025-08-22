import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, getAttributeName, getAttributes, StaticAttributeStaticValueParams } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class AriaRoleHeadingRequiresLevel extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode, parentNode }: StaticAttributeStaticValueParams): void {
    if (!(attributeName === "role" && attributeValue === "heading")) return

    const ariaLevelAttributes = getAttributes(parentNode).find(attribute => getAttributeName(attribute) === "aria-level")

    if (ariaLevelAttributes) return

    this.addOffense(
      `Element with \`role="heading"\` must have an \`aria-level\` attribute.`,
      attributeNode.location,
      "error"
    )
  }
}

export class HTMLAriaRoleHeadingRequiresLevelRule extends ParserRule {
  name = "html-aria-role-heading-requires-level"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaRoleHeadingRequiresLevel(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
