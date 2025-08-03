import { AttributeVisitorMixin } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { LintOffense } from "../types.js"
import type { Node, HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"

class HTMLAriaLevelMustBeValidVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (attributeName !== "aria-level") return
    if (attributeValue === null) return
    if (attributeValue.includes("<%")) return

    const number = parseInt(attributeValue)

    if (isNaN(number) || number < 1 || number > 6 || attributeValue !== number.toString()) {
      this.addOffense(
        `The \`aria-level\` attribute must be an integer between 1 and 6, got \`${attributeValue}\`.`,
        attributeNode.location,
      )
    }
  }
}

export class HTMLAriaLevelMustBeValidRule extends ParserRule {
  name = "html-aria-level-must-be-valid"

  check(node: Node): LintOffense[] {
    const visitor = new HTMLAriaLevelMustBeValidVisitor(this.name)

    visitor.visit(node)

    return visitor.offenses
  }
}
