import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, StaticAttributeStaticValueParams, StaticAttributeDynamicValueParams, isBooleanAttribute, hasAttributeValue } from "./rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({ originalAttributeName, attributeNode }: StaticAttributeStaticValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  protected checkStaticAttributeDynamicValue({ originalAttributeName, attributeNode }: StaticAttributeDynamicValueParams) {
    this.checkAttribute(originalAttributeName, attributeNode)
  }

  private checkAttribute(attributeName: string, attributeNode: HTMLAttributeNode) {
    if (!isBooleanAttribute(attributeName)) return
    if (!hasAttributeValue(attributeNode)) return

    this.addOffense(
      `Boolean attribute \`${IdentityPrinter.print(attributeNode.name)}\` should not have a value. Use \`${attributeName.toLowerCase()}\` instead of \`${IdentityPrinter.print(attributeNode)}\`.`,
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
