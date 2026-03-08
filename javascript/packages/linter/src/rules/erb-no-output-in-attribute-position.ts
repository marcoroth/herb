import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBNode, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLOpenTagNode } from "@herb-tools/core"

class ERBNoOutputInAttributePositionVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    for (const child of node.children) {
      if (!isERBNode(child)) continue
      if (!isERBOutputNode(child)) continue

      this.addOffense(
        "Avoid `<%= %>` in attribute position. Use `<% if ... %>` with static attributes instead.",
        child.location,
      )
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export class ERBNoOutputInAttributePositionRule extends ParserRule {
  static ruleName = "erb-no-output-in-attribute-position"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoOutputInAttributePositionVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
