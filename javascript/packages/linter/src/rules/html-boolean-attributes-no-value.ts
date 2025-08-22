import { ParserRule } from "../types.js"
import { AttributeVisitorMixin, isBooleanAttribute, hasAttributeValue } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode, Node, ParseResult } from "@herb-tools/core"

class BooleanAttributesNoValueVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue(attributeName: string, _attributeValue: string, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (!isBooleanAttribute(attributeName)) return
    if (!hasAttributeValue(attributeNode)) return

    this.addOffense(
      `Boolean attribute \`${attributeName}\` should not have a value. Use \`${attributeName}\` instead of \`${attributeName}="${attributeName}"\`.`,
      attributeNode.value!.location,
      "error"
    )
  }

  protected checkStaticAttributeDynamicValue(attributeName: string, _valueNodes: Node[], attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode, combinedValue?: string): void {
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
