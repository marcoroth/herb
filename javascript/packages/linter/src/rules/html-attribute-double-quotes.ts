import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, getAttributeValueQuoteType, hasAttributeValue } from "./rule-utils.js"
import { filterLiteralNodes } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class AttributeDoubleQuotesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeValue, attributeNode }: StaticAttributeStaticValueParams) {
    if (!hasAttributeValue(attributeNode)) return
    if (getAttributeValueQuoteType(attributeNode) !== "single") return
    if (attributeValue?.includes('"')) return

    this.addOffense(
      `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="${attributeValue}"\`.`,
      attributeNode.value!.location,
      "warning"
    )
  }

  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode, combinedValue }: StaticAttributeDynamicValueParams) {
    if (!hasAttributeValue(attributeNode)) return
    if (getAttributeValueQuoteType(attributeNode) !== "single") return
    if (filterLiteralNodes(valueNodes).some(node => node.content?.includes('"'))) return

    this.addOffense(
      `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="${combinedValue}"\`.`,
      attributeNode.value!.location,
      "warning"
    )
  }
}

export class HTMLAttributeDoubleQuotesRule extends ParserRule {
  name = "html-attribute-double-quotes"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AttributeDoubleQuotesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
