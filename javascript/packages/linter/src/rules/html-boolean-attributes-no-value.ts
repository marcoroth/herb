import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, isBooleanAttribute, hasAttributeValue } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ attributeName, attributeNode }: StaticAttributeStaticValueParams) {
    if (!isBooleanAttribute(attributeName)) return
    if (!hasAttributeValue(attributeNode)) return

    this.addOffense(
      `Boolean attribute \`${attributeName}\` should not have a value. Use \`${attributeName}\` instead of \`${attributeName}="${attributeName}"\`.`,
      attributeNode.value!.location,
      "error"
    )
  }

  protected checkStaticAttributeDynamicValue({ attributeName, attributeNode, combinedValue }: StaticAttributeDynamicValueParams) {
    if (!isBooleanAttribute(attributeName)) return
    if (!hasAttributeValue(attributeNode)) return

    this.addOffense(
      `Boolean attribute \`${attributeName}\` should not have a value. Use \`${attributeName}\` instead of \`${attributeName}="${combinedValue}"\`.`,
      attributeNode.value!.location,
      "error"
    )
  }
}

export class HTMLBooleanAttributesNoValueRule extends ParserRule {
  name = "html-boolean-attributes-no-value"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new BooleanAttributesNoValueVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
