import { AttributeVisitorMixin } from "./utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { LintOffense, LintContext } from "../types.js"
import type { Node, HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"

class HTMLAriaLevelMustBeValidVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (attributeName !== "aria-level") return
    if (attributeValue !== null && attributeValue.includes("<%")) return

    if (attributeValue === null || attributeValue === "") {
      this.addOffense(
        `The \`aria-level\` attribute must be an integer between 1 and 6, got an empty value.`,
        attributeNode.location,
      )

      return
    }

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

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLAriaLevelMustBeValidVisitor(this.name, context)

    visitor.visit(node)

    return visitor.offenses
  }
}
