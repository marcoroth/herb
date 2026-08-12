import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBCaseNode, ERBCaseMatchNode, ERBWhenNode, ERBInNode, ParseResult, ParserOptions } from "@herb-tools/core"

class ERBNoInlineCaseConditionsVisitor extends BaseRuleVisitor {
  visitERBCaseNode(node: ERBCaseNode): void {
    this.checkConditions(node, "when")
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.checkConditions(node, "in")
    this.visitChildNodes(node)
  }

  private checkConditions(node: ERBCaseNode | ERBCaseMatchNode, type: string): void {
    if (!node.conditions || node.conditions.length === 0) return

    for (const condition of node.conditions as (ERBWhenNode | ERBInNode)[]) {
      if (condition.tag_opening === null) {
        this.addOffense(
          `A \`case\` statement with \`${type}\` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for \`case\` and its conditions (e.g., \`<% case x %>\` followed by \`<% ${type} y %>\`).`,
          node.location,
        )
        break
      }
    }
  }
}

export class ERBNoInlineCaseConditionsRule extends ParserRule {
  static ruleName = "erb-no-inline-case-conditions"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { strict: false }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoInlineCaseConditionsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
