import { HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

export class HTMLTagNameLowercaseRule implements Rule {
  name = "html-tag-name-lowercase"
  description = "Enforce that all HTML tag names are written in lowercase"

  check(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): LintMessage[] {
    const messages: LintMessage[] = []

    if (!node.tag_name) {
      return messages
    }

    const tagName = node.tag_name.value
    const isLowercase = tagName === tagName.toLowerCase()

    if (!isLowercase) {
      messages.push({
        rule: this.name,
        message: `Tag name "${tagName}" should be lowercase. Use "${tagName.toLowerCase()}" instead.`,
        location: node.tag_name.location,
        severity: "error"
      })
    }

    return messages
  }
}
