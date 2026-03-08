import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBNode, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLAttributeNameNode } from "@herb-tools/core"

class ERBNoOutputInAttributeNameVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    for (const child of node.children) {
      if (!isERBNode(child)) continue
      if (!isERBOutputNode(child)) continue

      this.addOffense(
        "Avoid ERB output in attribute names. Use static attribute names with dynamic values instead.",
        child.location,
      )
    }

    super.visitHTMLAttributeNameNode(node)
  }
}

export class ERBNoOutputInAttributeNameRule extends ParserRule {
  static ruleName = "erb-no-output-in-attribute-name"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoOutputInAttributeNameVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
