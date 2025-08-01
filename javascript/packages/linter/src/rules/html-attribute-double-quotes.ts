import { AttributeVisitorMixin, getAttributeValueQuoteType, hasAttributeValue } from "./rule-utils.js"

import type { ParserRule, LintOffense } from "../types.js"
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

export class HTMLAttributeDoubleQuotesRule implements ParserRule {
  name = "html-attribute-double-quotes"

  check(node: Node): LintOffense[] {
    const visitor = new AttributeDoubleQuotesVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
