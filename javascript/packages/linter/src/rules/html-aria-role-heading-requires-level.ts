import { AttributeVisitorMixin, getAttributeName, getAttributes } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
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
      this.addMessage(
        `Element with role="heading" must have an aria-level attribute. Example: <div role="heading" aria-level="2">.`,
        attributeNode.location,
        "error"
      )
    }
  }
}

export class HTMLAriaRoleHeadingRequiresLevelRule implements Rule {
  name = "html-aria-role-heading-requires-level"

  check(node: Node): LintMessage[] {
    const visitor = new AriaRoleHeadingRequiresLevel(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
