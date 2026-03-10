import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class ImgRequireAltVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkImgTag(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "img") {
      return
    }

    if (!hasAttribute(node, "alt")) {
      this.addOffense(
        'Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLImgRequireAltRule extends ParserRule {
  name = "html-img-require-alt"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ImgRequireAltVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
