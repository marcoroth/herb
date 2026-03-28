import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"

import { getAttributeName } from "@herb-tools/core"

import type { ParseResult, ParserOptions, HTMLAttributeNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class NoAriaUnsupportedElementsVisitor extends ElementStackVisitor {
  private UNSUPPORTED_ELEMENTS = new Set([
    "html",
    "meta",
    "script",
    "style",
  ])

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    if (!this.currentTagName || !this.UNSUPPORTED_ELEMENTS.has(this.currentTagName)) return

    const attributeName = getAttributeName(node)
    if (!attributeName) return
    if (!attributeName.startsWith("aria-") && attributeName !== "role") return

    this.addOffense(
      `The \`${attributeName}\` attribute is not supported on the \`<${this.currentTagName}>\` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.`,
      node.location,
    )

    super.visitHTMLAttributeNode(node)
  }
}

export class A11yNoAriaUnsupportedElementsRule extends ParserRule {
  static ruleName = "a11y-no-aria-unsupported-elements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAriaUnsupportedElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
