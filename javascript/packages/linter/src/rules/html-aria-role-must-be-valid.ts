import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, VALID_ARIA_ROLES, StaticAttributeStaticValueParams } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class AriaRoleMustBeValid extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams): void {
    if (attributeName !== "role") return
    if (!attributeValue) return
    if (VALID_ARIA_ROLES.has(attributeValue)) return

    this.addOffense(
      `The \`role\` attribute must be a valid ARIA role. Role \`${attributeValue}\` is not recognized.`,
      attributeNode.location,
    )
  }
}

export class HTMLAriaRoleMustBeValidRule extends ParserRule {
  name = "html-aria-role-must-be-valid"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AriaRoleMustBeValid(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
