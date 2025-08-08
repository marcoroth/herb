import { AttributeVisitorMixin, getAttributeValueQuoteType, hasAttributeValue } from "./utils/rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { Node, HTMLAttributeNode } from "@herb-tools/core"

class AttributeDoubleQuotesVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, attributeValue: string | null, attributeNode: HTMLAttributeNode): void {
    if (!hasAttributeValue(attributeNode)) return
    if (getAttributeValueQuoteType(attributeNode) !== "single") return
    if (attributeValue?.includes('"')) return // Single quotes acceptable when value contains double quotes

    this.addOffense(
      `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="value"\`.`,
      attributeNode.value!.location,
      "warning"
    )
  }
}

export class HTMLAttributeDoubleQuotesRule extends ParserRule {
  name = "html-attribute-double-quotes"

  check(node: Node, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AttributeDoubleQuotesVisitor(this.name, context)
    visitor.visit(node)
    return visitor.offenses
  }
}
