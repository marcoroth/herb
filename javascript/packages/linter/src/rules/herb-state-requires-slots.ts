import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isStateDirective, slotsDirectiveMode } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

class StateRequiresSlotsVisitor extends BaseRuleVisitor {
  public firstDirective: ERBContentNode | null = null
  public declaresSlots = false

  visitERBContentNode(node: ERBContentNode): void {
    if (isStateDirective(node) && !this.firstDirective) {
      this.firstDirective = node
    }

    if (slotsDirectiveMode(node) !== null) {
      this.declaresSlots = true
    }
  }

  reportMissingSlots(): void {
    if (!this.firstDirective || this.declaresSlots) return

    this.addOffense(
      "`herb:state` declares client-owned state, but this template never opts into slots, so the states compile to nothing. Add `<%# herb:slots client %>` to park branch markup up front, or `<%# herb:slots server %>` to fetch it on demand.",
      this.firstDirective.location,
    )
  }
}

export class HerbStateRequiresSlotsRule extends ParserRule {
  static ruleName = "herb-state-requires-slots"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new StateRequiresSlotsVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.reportMissingSlots()

    return visitor.offenses
  }
}
