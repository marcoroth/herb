import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense } from "../types.js"
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
      this.addOffense(
        "Add an `href` attribute to `<a>` to ensure it is focusable and accessible.",
        node.tag_name!.location,
        "error",
      )
    }
  }
}

export class HTMLAnchorRequireHrefRule extends ParserRule {
  name = "html-anchor-require-href"

  check(node: Node): LintOffense[] {
    const visitor = new AnchorRechireHrefVisitor(this.name)

    visitor.visit(node)

    return visitor.offenses
  }
}
