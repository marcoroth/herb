import { BaseRuleVisitor } from "./rule-utils.js"
import { hasAttribute, getAttributeValue, findAttributeByName, getAttributes, getTagLocalName, isHTMLElementNode } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, ParseResult, ParserOptions } from "@herb-tools/core"

class SvgHasAccessibleTextVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkSvgElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkSvgElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "svg") {
      return
    }

    if (this.hasAriaHidden(node)) {
      return
    }

    if (this.hasAriaLabel(node) || this.hasAriaLabelledby(node) || this.hasDirectTitleChild(node)) {
      return
    }

    this.addOffense(
      "`<svg>` must have accessible text. Set `aria-label`, or `aria-labelledby`, or nest a `<title>` element. If the `<svg>` is decorative, hide it with `aria-hidden=\"true\"`.",
      node.tag_name!.location,
    )
  }

  private hasAriaLabel(node: HTMLElementNode): boolean {
    const openTag = node.open_tag as HTMLOpenTagNode
    return hasAttribute(openTag, "aria-label")
  }

  private hasAriaLabelledby(node: HTMLElementNode): boolean {
    const openTag = node.open_tag as HTMLOpenTagNode
    return hasAttribute(openTag, "aria-labelledby")
  }

  private hasAriaHidden(node: HTMLElementNode): boolean {
    const openTag = node.open_tag as HTMLOpenTagNode
    if (!hasAttribute(openTag, "aria-hidden")) {
      return false
    }

    const attributes = getAttributes(openTag)
    const ariaHiddenAttr = findAttributeByName(attributes, "aria-hidden")

    if (!ariaHiddenAttr) {
      return false
    }

    const value = getAttributeValue(ariaHiddenAttr)

    return value === "true"
  }

  private hasDirectTitleChild(node: HTMLElementNode): boolean {
    if (!node.body || node.body.length === 0) {
      return false
    }

    for (const child of node.body) {
      if (isHTMLElementNode(child)) {
        const childTagName = getTagLocalName(child)

        if (childTagName === "title") {
          return true
        }
      }
    }

    return false
  }
}

export class A11ySvgHasAccessibleTextRule extends ParserRule {
  static ruleName = "a11y-svg-has-accessible-text"
  static introducedIn = this.version("0.9.6")

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
    const visitor = new SvgHasAccessibleTextVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
