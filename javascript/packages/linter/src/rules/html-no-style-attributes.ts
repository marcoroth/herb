import { getAttributeName } from "@herb-tools/core"
import type { ParseResult, ParserOptions, HTMLAttributeNode } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import { ParserRule } from "../types.js"

class HTMLNoStyleAttributesVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    const attributeName = getAttributeName(node)

    if (attributeName && attributeName.toLowerCase() === "style") {
      this.addOffense(
        "Avoid inline `style` attribute. Use CSS classes or an external stylesheet instead.",
        node.location,
      )
    }

    super.visitHTMLAttributeNode(node)
  }
}

export class HTMLNoStyleAttributesRule extends ParserRule {
  static ruleName = "html-no-style-attributes"
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
    const visitor = new HTMLNoStyleAttributesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
