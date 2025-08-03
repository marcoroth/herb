import { AttributeVisitorMixin } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense } from "../types.js"
import type { HTMLAttributeNode, HTMLAttributeValueNode, Node } from "@herb-tools/core"

class AttributeValuesRequireQuotesVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, _attributeValue: string | null, attributeNode: HTMLAttributeNode): void {
    if (attributeNode.value?.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE") return

    const valueNode = attributeNode.value as HTMLAttributeValueNode
    if (valueNode.quoted) return

    this.addOffense(
      // TODO: print actual attribute value in message
      `Attribute value should be quoted: \`${attributeName}="value"\`. Always wrap attribute values in quotes.`,
      valueNode.location,
      "error"
    )
  }
}

export class HTMLAttributeValuesRequireQuotesRule extends ParserRule {
  name = "html-attribute-values-require-quotes"

  check(node: Node): LintOffense[] {
    const visitor = new AttributeValuesRequireQuotesVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
