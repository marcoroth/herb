import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isStateDirective, slotsDirectiveMode } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

class StateRequiresClientModeVisitor extends BaseRuleVisitor {
  public firstDirective: ERBContentNode | null = null
  public clientMode = false

  visitERBContentNode(node: ERBContentNode): void {
    if (isStateDirective(node) && !this.firstDirective) {
      this.firstDirective = node
    }

    if (slotsDirectiveMode(node) === "client") {
      this.clientMode = true
    }
  }

  reportServerMode(): void {
    if (!this.firstDirective || this.clientMode) return

    this.addOffense(
      "`herb:state` declares client-owned state, but this template renders its slots in server mode, so no state can ever change anything. Add `<%# herb:slots client %>` so the branches a state drives are parked for the client.",
      this.firstDirective.location,
    )
  }
}

export class HerbStateRequiresClientModeRule extends ParserRule {
  static ruleName = "herb-state-requires-client-mode"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new StateRequiresClientModeVisitor(this.ruleName, context)

    visitor.visit(result.value)
    visitor.reportServerMode()

    return visitor.offenses
  }
}
