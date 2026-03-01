import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, hasAttribute, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

const INTERACTIVE_ELEMENTS = new Set([
  "button", "summary", "input", "select", "textarea", "a"
])

class NoAriaHiddenOnFocusableVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAriaHiddenOnFocusable(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkAriaHiddenOnFocusable(node: HTMLOpenTagNode): void {
    if (!this.hasAriaHiddenTrue(node)) return

    if (this.isFocusable(node)) {
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

  private isFocusable(node: HTMLOpenTagNode): boolean {
    const tagName = getTagName(node)
    if (!tagName) return false

    const tabIndexValue = this.getTabIndexValue(node)

    if (tagName === "a") {
      const hasHref = hasAttribute(node, "href")

      if (!hasHref) {
        return tabIndexValue !== null && tabIndexValue >= 0
      }

      return tabIndexValue === null || tabIndexValue >= 0
    }

    if (INTERACTIVE_ELEMENTS.has(tagName)) {
      // Interactive elements are focusable unless tabindex is negative
      return tabIndexValue === null || tabIndexValue >= 0
    } else {
      // Non-interactive elements are focusable only if tabindex >= 0
      return tabIndexValue !== null && tabIndexValue >= 0
    }
  }

  private getTabIndexValue(node: HTMLOpenTagNode): number | null {
    const attributes = getAttributes(node)
    const tabIndexAttribute = findAttributeByName(attributes, "tabindex")

    if (!tabIndexAttribute) return null

    const value = getAttributeValue(tabIndexAttribute)
    if (!value) return null

    const parsed = parseInt(value, 10)

    return isNaN(parsed) ? null : parsed
  }
}

export class HTMLNoAriaHiddenOnFocusableRule extends ParserRule {
  name = "html-no-aria-hidden-on-focusable"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAriaHiddenOnFocusableVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
