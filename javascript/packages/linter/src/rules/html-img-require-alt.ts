import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

class ImgRequireAltVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkImgTag(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "img") {
      return
    }

    if (!hasAttribute(node, "alt")) {
      this.addMessage(
        'Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLImgRequireAltRule implements Rule {
  name = "html-img-require-alt"

  check(node: Node): LintMessage[] {
    const visitor = new ImgRequireAltVisitor(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
