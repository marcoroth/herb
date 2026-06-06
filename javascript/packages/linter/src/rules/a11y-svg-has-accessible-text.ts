import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { hasAttribute, getStaticAttributeValue, getTagLocalName, isHTMLElementNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult, ParserOptions } from "@herb-tools/core"

class SvgHasAccessibleTextVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkSVGElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkSVGElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "svg") return
    if (this.hasAriaHidden(node)) return

    if (hasAttribute(node, "aria-label")) return
    if (hasAttribute(node, "aria-labelledby")) return
    if (this.hasDirectTitleChild(node)) return

    this.addOffense(
      "`<svg>` must have accessible text. Set `aria-label`, or `aria-labelledby`, or nest a `<title>` element. If the `<svg>` is decorative, hide it with `aria-hidden=\"true\"`.",
      node.tag_name!.location,
    )
  }

  private hasAriaHidden(node: HTMLElementNode): boolean {
    if (!hasAttribute(node, "aria-hidden")) return false

    const value = getStaticAttributeValue(node, "aria-hidden")
    if (value === null) return true

    return value === "true"
  }

  private hasDirectTitleChild(node: HTMLElementNode): boolean {
    const children = node.body ?? []

    return children.some(child => isHTMLElementNode(child) && getTagLocalName(child) === "title")
  }
}

export class A11ySVGHasAccessibleTextRule extends ParserRule {
  static ruleName = "a11y-svg-has-accessible-text"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new SvgHasAccessibleTextVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
