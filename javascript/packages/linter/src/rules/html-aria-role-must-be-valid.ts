import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, VALID_ARIA_ROLES } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"

class AriaRoleMustBeValid extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue(attributeName: string, attributeValue: string, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (attributeName !== "role") return
    if (!attributeValue) return
    if (VALID_ARIA_ROLES.has(attributeValue)) return

    this.addOffense(
      `The \`role\` attribute must be a valid ARIA role. Role \`${attributeValue}\` is not recognized.`,
      attributeNode.location,
      "error"
    )
  }
}

export class HTMLAriaRoleMustBeValidRule extends ParserRule {
  name = "html-aria-role-must-be-valid"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaRoleMustBeValid(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
