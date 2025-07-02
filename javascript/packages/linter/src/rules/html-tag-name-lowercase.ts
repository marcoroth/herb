import { BaseRuleVisitor } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

class TagNameLowercaseVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagName(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.checkTagName(node)
    super.visitHTMLCloseTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkTagName(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): void {
    const tagName = node.tag_name?.value
    if (!tagName) return

    if (tagName !== tagName.toLowerCase()) {
      this.addMessage(
        `Tag name \`${tagName}\` should be lowercase. Use \`${tagName.toLowerCase()}\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTagNameLowercaseRule implements Rule {
  name = "html-tag-name-lowercase"

  check(node: Node): LintMessage[] {
    const visitor = new TagNameLowercaseVisitor(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
