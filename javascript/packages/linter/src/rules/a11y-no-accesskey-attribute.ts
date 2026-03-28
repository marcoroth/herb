import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"
import { hasAttribute, isERBOpenTagNode, findAttributeByName } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class NoAccesskeyAttributeVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (this.hasAccesskey(node)) {
      this.addOffense(
        "Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.",
        node.tag_name!.location,
      )
    }

    super.visitHTMLElementNode(node)
  }

  private hasAccesskey(node: HTMLElementNode): boolean {
    const openTag = node.open_tag

    if (isERBOpenTagNode(openTag)) {
      return findAttributeByName(openTag.children, "accesskey") !== null
    } else {
      return hasAttribute(node, "accesskey")
    }
  }
}

export class A11yNoAccesskeyAttributeRule extends ParserRule {
  static ruleName = "a11y-no-accesskey-attribute"
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
    const visitor = new NoAccesskeyAttributeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
