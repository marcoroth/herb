import { type ParseResult, type ParserOptions, type HTMLAttributeNode, getAttributeName } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class NoAccesskeyAttributeVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    if (getAttributeName(node) === "accesskey") {
      this.addOffense(
        "Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.",
        node.location,
      )
    }

    super.visitHTMLAttributeNode(node)
  }
}

export class A11yNoAccesskeyAttributeRule extends ParserRule {
  static ruleName = "a11y-no-accesskey-attribute"
  static introducedIn = this.version("0.9.3")

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
    const visitor = new NoAccesskeyAttributeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
