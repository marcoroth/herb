import {
  HTMLOpenTagNode,
  HTMLAttributeNode,
  HTMLAttributeNameNode,
} from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

export class HTMLAnchorRequireHrefRule implements Rule {
  name = "html-anchor-require-href"
  description =
    "Disallow the use of anchor tags without anhref attribute in HTML templates."

  check(node: HTMLOpenTagNode): LintMessage[] {
    const messages: LintMessage[] = []

    // Only check nodes that can have attributes (opening and self-closing tags)
    if (
      node.type !== "AST_HTML_OPEN_TAG_NODE" ||
      !node.tag_name ||
      node.tag_name.value.toLowerCase() !== "a"
    ) {
      return messages
    }

    let hasHrefAttribute = false

    for (const child of node.children) {
      if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
        const attributeNode = child as HTMLAttributeNode

        if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
          const nameNode = attributeNode.name as HTMLAttributeNameNode

          if (nameNode.name && nameNode.name.value.toLowerCase() === "href") {
            hasHrefAttribute = true
            break
          }
        }
      }
    }

    if (!hasHrefAttribute) {
      messages.push({
        rule: this.name,
        message: "Missing required `href` attribute on `<a>` tag.",
        location: node.tag_name.location,
        severity: "error",
      })
    }

    return messages
  }
}
