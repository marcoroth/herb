import { HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode, HTMLAttributeNode, HTMLAttributeNameNode } from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

export class HTMLNoDuplicateAttributesRule implements Rule {
  name = "html-no-duplicate-attributes"
  description = "Disallow having multiple attributes with the same name on a single HTML tag"

  check(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): LintMessage[] {
    const messages: LintMessage[] = []

    // Only check nodes that can have attributes (opening and self-closing tags)
    if (node.type !== "AST_HTML_OPEN_TAG_NODE" && node.type !== "AST_HTML_SELF_CLOSE_TAG_NODE") {
      return messages
    }

    // Collect all attribute names and their locations
    const attributeNames = new Map<string, HTMLAttributeNameNode[]>()

    const attributes = node.type === "AST_HTML_SELF_CLOSE_TAG_NODE"
      ? (node as HTMLSelfCloseTagNode).attributes
      : (node as HTMLOpenTagNode).children

    for (const child of attributes) {
      if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
        const attributeNode = child as HTMLAttributeNode

        if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
          const nameNode = attributeNode.name as HTMLAttributeNameNode

          if (nameNode.name) {
            const attributeName = nameNode.name.value.toLowerCase() // HTML attributes are case-insensitive

            if (!attributeNames.has(attributeName)) {
              attributeNames.set(attributeName, [])
            }
            attributeNames.get(attributeName)!.push(nameNode)
          }
        }
      }
    }

    // Check for duplicates
    for (const [attributeName, nameNodes] of attributeNames) {
      if (nameNodes.length > 1) {
        // Report error for all occurrences after the first
        for (let i = 1; i < nameNodes.length; i++) {
          const nameNode = nameNodes[i]
          messages.push({
            rule: this.name,
            message: `Duplicate attribute "${attributeName}" found on tag. Remove the duplicate occurrence.`,
            location: nameNode.location,
            severity: "error"
          })
        }
      }
    }

    return messages
  }
}
