import { ParserRule } from "../types.js"
import { AttributeVisitorMixin } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { HTMLAttributeNode, HTMLAttributeValueNode, HTMLOpenTagNode, HTMLSelfCloseTagNode, Node, ParseResult } from "@herb-tools/core"

class AttributeValuesRequireQuotesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue(attributeName: string, attributeValue: string, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (this.hasAttributeValue(attributeNode)) return
    if (this.isQuoted(attributeNode)) return

    this.addOffense(
      `Attribute value should be quoted: \`${attributeName}="${attributeValue}"\`. Always wrap attribute values in quotes.`,
      attributeNode.value!.location,
      "error"
    )
  }

  protected checkStaticAttributeDynamicValue(attributeName: string, _valueNodes: Node[], attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode, combinedValue?: string): void {
    if (this.hasAttributeValue(attributeNode)) return
    if (this.isQuoted(attributeNode)) return

    this.addOffense(
      `Attribute value should be quoted: \`${attributeName}="${combinedValue}"\`. Always wrap attribute values in quotes.`,
      attributeNode.value!.location,
      "error"
    )
  }

  private hasAttributeValue(attributeNode: HTMLAttributeNode): boolean {
    return attributeNode.value?.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE"
  }

  private isQuoted(attributeNode: HTMLAttributeNode): boolean {
    const valueNode = attributeNode.value as HTMLAttributeValueNode

    return valueNode.quoted
  }
}

export class HTMLAttributeValuesRequireQuotesRule extends ParserRule {
  name = "html-attribute-values-require-quotes"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AttributeValuesRequireQuotesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
