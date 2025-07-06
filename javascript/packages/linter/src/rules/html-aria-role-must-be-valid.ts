import { AttributeVisitorMixin, VALID_ARIA_ROLES } from "./rule-utils.js"

import type { Rule, LintOffense } from "../types.js"
import type { Node, HTMLAttributeNode } from "@herb-tools/core"


class AriaRoleMustBeValid extends AttributeVisitorMixin {

  checkAttribute(
    attributeName: string,
    attributeValue: string | null,
    attributeNode: HTMLAttributeNode,
  ): void {

    if (attributeName !== "role" || attributeValue === null) {
      return;
    }

    if (!VALID_ARIA_ROLES.has(attributeValue)) {
      this.addOffense(
        `Invalid aria-role: "${attributeValue}".`,
        attributeNode.location,
        "error"
      );
      return;
    }
  }
}

export class HTMLAriaRoleMustBeValid implements Rule {
  name = "html-aria-role-must-be-valid"

  check(node: Node): LintOffense[] {
    const visitor = new AriaRoleMustBeValid(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
