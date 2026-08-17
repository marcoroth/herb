import { ParserRule } from "../types.js"
import { BaseRuleVisitor, isKeyboardFocusableElement } from "./rule-utils.js"
import { getAttributeValue, findAttributeByName, getAttributes } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NoAriaHiddenOnFocusableVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAriaHiddenOnFocusable(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkAriaHiddenOnFocusable(node: HTMLOpenTagNode): void {
    if (!this.hasAriaHiddenTrue(node)) return

    if (isKeyboardFocusableElement(node)) {
      this.addOffense(
        `Elements that are focusable should not have \`aria-hidden="true"\` because it will cause confusion for assistive technology users.`,
        node.tag_name!.location,
      )
    }
  }

  private hasAriaHiddenTrue(node: HTMLOpenTagNode): boolean {
    const attributes = getAttributes(node)
    const ariaHiddenAttr = findAttributeByName(attributes, "aria-hidden")

    if (!ariaHiddenAttr) return false

    const value = getAttributeValue(ariaHiddenAttr)

    return value === "true"
  }

}

export class HTMLNoAriaHiddenOnFocusableRule extends ParserRule {
  static ruleName = "html-no-aria-hidden-on-focusable"
  static introducedIn = this.version("0.6.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAriaHiddenOnFocusableVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
