import { hasAttribute } from "@herb-tools/core"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class NoAutofocusAttributeVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkAutofocusAttribute(node)

    super.visitHTMLOpenTagNode(node)
  }

  private checkAutofocusAttribute(node: HTMLOpenTagNode): void {
    if (!hasAttribute(node, "autofocus")) return;

    this.addOffense(
      "Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.",
      node.tag_name!.location,
    )
  }
}

export class A11yNoAutofocusAttributeRule extends ParserRule {
  static ruleName = "a11y-no-autofocus-attribute"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoAutofocusAttributeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
