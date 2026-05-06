import { BaseRuleVisitor } from "./rule-utils.js"
import { getAttribute, hasAttributeValue } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class TurboPermanentNoMisleadingValueVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTurboPermanentAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTurboPermanentAttribute(node: HTMLOpenTagNode): void {
    const attribute = getAttribute(node, "data-turbo-permanent")

    if (!attribute) return
    if (!hasAttributeValue(attribute)) return

    this.addOffense(
      "Attribute `data-turbo-permanent` should not contain any value. Its presence alone enables the behavior, so values like `\"true\"` or `\"false\"` are misleading.",
      attribute.value!.location,
    )
  }
}

export class TurboPermanentNoMisleadingValueRule extends ParserRule {
  static ruleName = "turbo-permanent-no-misleading-value"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new TurboPermanentNoMisleadingValueVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
