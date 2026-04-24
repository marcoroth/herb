import { hasAttribute, getTagLocalName } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

const VALID_DISABLED_TAGS = new Set([
  "button", "fieldset", "input", "optgroup", "option", "select", "textarea", "task-lists"
])

class DisabledAttributeVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkDisabledAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkDisabledAttribute(node: HTMLOpenTagNode): void {
    if (!hasAttribute(node, "disabled")) return

    const tagName = getTagLocalName(node)
    if (!tagName) return
    if (VALID_DISABLED_TAGS.has(tagName)) return

    this.addOffense(
      `The \`disabled\` attribute is only valid on ${[...VALID_DISABLED_TAGS].join(", ")}.`,
      node.tag_name!.location,
    )
  }
}

export class A11yDisabledAttributeRule extends ParserRule {
  static ruleName = "a11y-disabled-attribute"
  static introducedIn = "unreleased"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new DisabledAttributeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
