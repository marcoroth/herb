import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import { isPartialFile } from "../utils/file-utils.js"

import type { ParseResult, ERBStrictLocalsNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ActionViewStrictLocalsPartialOnlyVisitor extends BaseRuleVisitor {
  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.addOffense(
      "Only partials should declare strict locals. Use instance variables in a template, or `content_for` in a layout.",
      node.location,
    )
  }
}

export class ActionViewStrictLocalsPartialOnlyRule extends ParserRule {
  static ruleName = "actionview-strict-locals-partial-only"
  static introducedIn = this.version("0.9.3")

  get parserOptions() {
    return { strict_locals: true }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning",
      frameworks: ["actionview"],
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) !== false) return []

    const visitor = new ActionViewStrictLocalsPartialOnlyVisitor(this.ruleName, context)
    visitor.visit(result.value)

    return visitor.offenses
  }
}
