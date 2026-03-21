import { BaseRuleVisitor } from "./rule-utils.js"
import { hasAttribute, getAttribute, hasAttributeValue, getTagLocalName, isHTMLOpenTagNode, isERBOpenTagNode, filterHTMLAttributeNodes, findAttributeByName } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLAttributeNode, ParseResult, ParserOptions } from "@herb-tools/core"

class ImgRequireAltVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkImgTag(node)
    super.visitHTMLElementNode(node)
  }

  private checkImgTag(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "img") {
      return
    }

    const altAttribute = this.getAltAttribute(node)

    if (!altAttribute) {
      this.addOffense(
        'Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        node.tag_name!.location
      )
      return
    }

    if (!hasAttributeValue(altAttribute)) {
      this.addOffense(
        'The `alt` attribute has no value. Add `alt=""` for decorative images or `alt="description"` for informative images.',
        altAttribute.location
      )
    }
  }

  private getAltAttribute(node: HTMLElementNode): HTMLAttributeNode | null {
    const openTag = node.open_tag

    if (isHTMLOpenTagNode(openTag)) {
      return getAttribute(openTag, "alt")
    }

    if (isERBOpenTagNode(openTag)) {
      return findAttributeByName(filterHTMLAttributeNodes(openTag.children), "alt")
    }

    return null
  }
}

export class HTMLImgRequireAltRule extends ParserRule {
  static ruleName = "html-img-require-alt"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { action_view_helpers: true }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ImgRequireAltVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
