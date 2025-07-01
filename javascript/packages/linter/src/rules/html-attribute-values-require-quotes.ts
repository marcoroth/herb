import { AttributeVisitorMixin } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { HTMLAttributeNode, HTMLAttributeValueNode, Node } from "@herb-tools/core"

class AttributeValuesRequireQuotesVisitor extends AttributeVisitorMixin {
  protected checkAttribute(attributeName: string, _attributeValue: string | null, attributeNode: HTMLAttributeNode): void {
    if (attributeNode.value?.type !== "AST_HTML_ATTRIBUTE_VALUE_NODE") return

    const valueNode = attributeNode.value as HTMLAttributeValueNode
    if (valueNode.quoted) return

    this.addMessage(
      `Attribute value should be quoted: \`${attributeName}="value"\`. Always wrap attribute values in quotes.`,
      valueNode.location,
      "error"
    )
  }
}

export class HTMLAttributeValuesRequireQuotesRule implements Rule {
  name = "html-attribute-values-require-quotes"

  check(node: Node): LintMessage[] {
    const visitor = new AttributeValuesRequireQuotesVisitor(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
