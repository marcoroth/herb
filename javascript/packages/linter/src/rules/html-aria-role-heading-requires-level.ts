import { AttributeVisitorMixin, getAttributeName, getAttributes } from "./utils/rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { Node, HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"

class AriaRoleHeadingRequiresLevel extends AttributeVisitorMixin {

  // We want to check 2 attributes here:
  // 1. role="heading"
  // 2. aria-level (which must be present if role="heading")
  checkAttribute(
    attributeName: string,
    attributeValue: string | null,
    attributeNode: HTMLAttributeNode,
    parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode
  ): void {

    if (!(attributeName === "role" && attributeValue === "heading")) {
      return
    }

    const allAttributes = getAttributes(parentNode)

    // If we have a role="heading", we must check for aria-level
    const ariaLevelAttr = allAttributes.find(attr => getAttributeName(attr) === "aria-level")
    if (!ariaLevelAttr) {
      this.addOffense(
        `Element with \`role="heading"\` must have an \`aria-level\` attribute.`,
        attributeNode.location,
        "error"
      )
    }
  }
}

export class HTMLAriaRoleHeadingRequiresLevelRule extends ParserRule {
  name = "html-aria-role-heading-requires-level"

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaRoleHeadingRequiresLevel(this.name, context)
    visitor.visit(node)
    return visitor.offenses
  }
}
