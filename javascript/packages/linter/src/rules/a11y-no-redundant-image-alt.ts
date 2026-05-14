import { BaseRuleVisitor } from "./rule-utils.js"
import { getAttribute, getAttributeValue, hasAttributeValue, getTagLocalName, isHTMLOpenTagNode, isERBOpenTagNode, filterHTMLAttributeNodes, findAttributeByName, hasDynamicAttributeValue } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLAttributeNode, ParseResult, ParserOptions } from "@herb-tools/core"

const REDUNDANT_ALT_WORDS = new Set(["image", "picture"])

class NoRedundantImageAltVisitor extends BaseRuleVisitor {
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

    if (!altAttribute) return
    if (!hasAttributeValue(altAttribute)) return
    if (hasDynamicAttributeValue(altAttribute)) return

    const altValue = getAttributeValue(altAttribute)

    if (!altValue) return

    const words = altValue.toLowerCase().split(/\s+/)

    if (words.some(word => REDUNDANT_ALT_WORDS.has(word))) {
      this.addOffense(
        "`<img>` `alt` prop should not contain \"image\" or \"picture\" as screen readers already announce the element as an image.",
        altAttribute.location,
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

export class A11yNoRedundantImageAltRule extends ParserRule {
  static ruleName = "a11y-no-redundant-image-alt"
  static introducedIn = this.version("0.9.7")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { action_view_helpers: true }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoRedundantImageAltVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
