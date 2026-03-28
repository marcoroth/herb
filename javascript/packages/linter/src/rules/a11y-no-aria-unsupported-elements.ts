import type { ParseResult, ParserOptions, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"
import { getTagLocalName, getAttributeName, isERBOpenTagNode, isHTMLOpenTagNode, filterHTMLAttributeNodes } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const UNSUPPORTED_ELEMENTS = new Set([
  "html",
  "meta",
  "script",
  "style",
])

class NoAriaUnsupportedElementsVisitor extends BaseRuleVisitor {
  private currentTagName: string | null = null
  
  visitHTMLElementNode(node: HTMLElementNode): void {  
    this.currentTagName = getTagLocalName(node)
    super.visitHTMLElementNode(node)
    this.currentTagName = null
  }
  
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    if (!this.currentTagName || !UNSUPPORTED_ELEMENTS.has(this.currentTagName)) return
  
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
