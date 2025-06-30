import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode } from "@herb-tools/core"
import type { Rule, LintMessage } from "../types.js"

export class HTMLBooleanAttributesNoValueRule implements Rule {
  name = "html-boolean-attributes-no-value"
  description = "Omit attribute values for boolean HTML attributes"

  // List of known boolean attributes in HTML
  private booleanAttributes = new Set([
    "autofocus", "autoplay", "checked", "controls", "defer", "disabled", "hidden",
    "loop", "multiple", "muted", "readonly", "required", "reversed", "selected",
    "open", "default", "formnovalidate", "novalidate", "itemscope", "scoped",
    "seamless", "allowfullscreen", "async", "compact", "declare", "nohref",
    "noresize", "noshade", "nowrap", "sortable", "truespeed", "typemustmatch"
  ])

  check(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): LintMessage[] {
    const messages: LintMessage[] = []

    // Only check nodes that can have attributes (opening and self-closing tags)
    if (node.type !== "AST_HTML_OPEN_TAG_NODE" && node.type !== "AST_HTML_SELF_CLOSE_TAG_NODE") {
      return messages
    }

    const attributes = node.type === "AST_HTML_SELF_CLOSE_TAG_NODE"
      ? (node as HTMLSelfCloseTagNode).attributes
      : (node as HTMLOpenTagNode).children

    for (const child of attributes) {
      if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
        const attributeNode = child as HTMLAttributeNode

        if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
          const nameNode = attributeNode.name as HTMLAttributeNameNode

          if (nameNode.name) {
            const attributeName = nameNode.name.value.toLowerCase()

            // Check if this is a boolean attribute with a value
            if (this.booleanAttributes.has(attributeName) && attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
              const valueNode = attributeNode.value as HTMLAttributeValueNode

              messages.push({
                rule: this.name,
                message: `Boolean attribute \`${attributeName}\` should not have a value. Use \`${attributeName}\` instead of \`${attributeName}="${attributeName}"\`.`,
                location: valueNode.location,
                severity: "error"
              })
            }
          }
        }
      }
    }

    return messages
  }
}
