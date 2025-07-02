import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import { Rule, LintMessage } from "../types.js"
import type { HTMLOpenTagNode, Node } from "@herb-tools/core"

class AnchorRechireHrefVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkATag(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkATag(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "a") {
      return
    }

    if (!hasAttribute(node, "href")) {
      this.addMessage(
        "Missing required `href` attribute on `<a>` tag.",
        node.tag_name!.location,
        "error",
      )
    }
  }
}

export class HTMLAnchorRequireHrefRule implements Rule {
  name = "html-anchor-require-href"

  check(node: Node): LintMessage[] {
    const visitor = new AnchorRechireHrefVisitor(this.name)

    visitor.visit(node)

    return visitor.messages
  }
}
