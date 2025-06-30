import { HTMLOpenTagNode, HTMLSelfCloseTagNode, HTMLAttributeNode, HTMLAttributeNameNode } from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

export class HTMLImgRequireAltRule implements Rule {
  name = "html-img-require-alt"
  description = "Enforce that all <img> elements include an alt attribute"

  check(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): LintMessage[] {
    const messages: LintMessage[] = []

    // Only check img tags
    if (!node.tag_name || node.tag_name.value.toLowerCase() !== "img") {
      return messages
    }

    // Check if the img tag has an alt attribute
    let hasAltAttribute = false

    const attributes = node.type === "AST_HTML_SELF_CLOSE_TAG_NODE"
      ? (node as HTMLSelfCloseTagNode).attributes
      : (node as HTMLOpenTagNode).children

    for (const child of attributes) {
      if (child.type === "AST_HTML_ATTRIBUTE_NODE") {
        const attributeNode = child as HTMLAttributeNode

        if (attributeNode.name?.type === "AST_HTML_ATTRIBUTE_NAME_NODE") {
          const nameNode = attributeNode.name as HTMLAttributeNameNode

          if (nameNode.name && nameNode.name.value.toLowerCase() === "alt") {
            hasAltAttribute = true
            break
          }
        }
      }
    }

    if (!hasAltAttribute) {
      messages.push({
        rule: this.name,
        message: 'Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        location: node.tag_name.location,
        severity: "error"
      })
    }

    return messages
  }
}
