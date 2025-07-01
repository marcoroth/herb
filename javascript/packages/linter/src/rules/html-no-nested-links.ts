import { BaseRuleVisitor, getTagName } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, Node } from "@herb-tools/core"

class NestedLinkVisitor extends BaseRuleVisitor {
  private linkStack: HTMLOpenTagNode[] = []

  private checkNestedLink(openTag: HTMLOpenTagNode): boolean {
    if (this.linkStack.length > 0) {
      this.addMessage(
        "Nested `<a>` elements are not allowed. Links cannot contain other links.",
        openTag.tag_name!.location,
        "error"
      )

      return true
    }

    return false
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!node.open_tag || node.open_tag.type !== "AST_HTML_OPEN_TAG_NODE") {
      super.visitHTMLElementNode(node)
      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = getTagName(openTag)

    if (tagName !== "a") {
      super.visitHTMLElementNode(node)
      return
    }

    // If we're already inside a link, this is a nested link
    this.checkNestedLink(openTag)

    this.linkStack.push(openTag)
    super.visitHTMLElementNode(node)
    this.linkStack.pop()
  }

  // Handle self-closing <a> tags (though they're not valid HTML, they might exist)
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName === "a" && node.is_void) {
      this.checkNestedLink(node)
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export class HTMLNoNestedLinksRule implements Rule {
  name = "html-no-nested-links"

  check(node: Node): LintMessage[] {
    const visitor = new NestedLinkVisitor(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
