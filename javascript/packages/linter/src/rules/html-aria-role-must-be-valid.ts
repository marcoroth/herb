import { AttributeVisitorMixin, VALID_ARIA_ROLES } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { Node, HTMLAttributeNode } from "@herb-tools/core"

class AriaRoleMustBeValid extends AttributeVisitorMixin {
  checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: HTMLAttributeNode,): void {
    if (attributeName !== "role") return
    if (attributeValue === null) return
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

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaRoleMustBeValid(this.name, context)

    visitor.visit(node)

    return visitor.offenses
  }
}
