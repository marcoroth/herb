import { BaseRuleVisitor } from "./rule-utils.js"
import { hasAttribute, getAttribute, hasAttributeValue, getTagLocalName } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class ImgRequireAltVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkImgTag(node: HTMLOpenTagNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "img") {
      return
    }

    if (!hasAttribute(node, "alt")) {
      this.addOffense(
        'Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        node.tag_name!.location
      )
      return
    }

    const altAttribute = getAttribute(node, "alt")

    if (altAttribute && !hasAttributeValue(altAttribute)) {
      this.addOffense(
        'The `alt` attribute has no value. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        altAttribute.location
      )
    }
  }
}

export class HTMLImgRequireAltRule extends ParserRule {
  static ruleName = "html-img-require-alt"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ImgRequireAltVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
