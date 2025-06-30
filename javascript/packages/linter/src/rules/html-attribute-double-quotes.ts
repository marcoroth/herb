import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode, LiteralNode } from "@herb-tools/core"
import type { Rule, LintMessage } from "../types.js"

export class HTMLAttributeDoubleQuotesRule implements Rule {
  name = "html-attribute-double-quotes"
  description = "Prefer using double quotes (\") around HTML attribute values instead of single quotes (')"

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

        // Check if this attribute has a value
        if (attributeNode.value?.type === "AST_HTML_ATTRIBUTE_VALUE_NODE") {
          const valueNode = attributeNode.value as HTMLAttributeValueNode

          // If the value is quoted with single quotes, check if it contains double quotes
          if (valueNode.quoted && valueNode.open_quote && valueNode.open_quote.value === "'" && valueNode.close_quote && valueNode.close_quote.value === "'") {
            // Get the actual value content to check for double quotes
            let valueContent = ""
            if (valueNode.children && valueNode.children.length > 0) {
              // Concatenate all text content from children
              valueContent = valueNode.children
                .filter(child => child.type === "AST_LITERAL_NODE")
                .map(child => (child as LiteralNode).content)
                .join("")
            }

            // Only report error if the value doesn't contain double quotes
            // (single quotes are acceptable when the value contains double quotes)
            if (!valueContent.includes('"')) {
              let attributeName = "unknown"
              if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
                const nameNode = attributeNode.name as HTMLAttributeNameNode
                if (nameNode.name) {
                  attributeName = nameNode.name.value
                }
              }

              messages.push({
                rule: this.name,
                message: `Attribute \`${attributeName}\` uses single quotes. Prefer double quotes for HTML attribute values: \`${attributeName}="value"\`.`,
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
