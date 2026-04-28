import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams } from "./rule-utils.js"
import { getAttributeName, getAttributes } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class AriaRoleHeadingRequiresLevel extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode, parentNode }: StaticAttributeStaticValueParams): void {
    if (!(attributeName === "role" && attributeValue === "heading")) return

    const ariaLevelAttributes = getAttributes(parentNode).find(attribute => getAttributeName(attribute) === "aria-level")

    if (ariaLevelAttributes) return

    this.addOffense(
      `Element with \`role="heading"\` must have an \`aria-level\` attribute.`,
      attributeNode.location,
    )
  }
}

export class HTMLAriaRoleHeadingRequiresLevelRule extends ParserRule {
  static ruleName = "html-aria-role-heading-requires-level"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AriaRoleHeadingRequiresLevel(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
