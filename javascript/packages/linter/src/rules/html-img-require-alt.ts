import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
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
        node.tag_name!.location
      )
    }
  }
}

export class HTMLImgRequireAltRule extends ParserRule {
  name = "html-img-require-alt"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ImgRequireAltVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
