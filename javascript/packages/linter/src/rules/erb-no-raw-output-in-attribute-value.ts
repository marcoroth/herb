import { ParserRule } from "../types.js"
import { AttributeVisitorMixin } from "./rule-utils.js"
import { isERBNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, Node } from "@herb-tools/core"
import type { StaticAttributeDynamicValueParams, DynamicAttributeDynamicValueParams } from "./rule-utils.js"

class ERBNoRawOutputInAttributeValueVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeDynamicValue({ valueNodes, attributeNode }: StaticAttributeDynamicValueParams): void {
    this.checkValueNodes(valueNodes)
  }

  protected checkDynamicAttributeDynamicValue({ valueNodes }: DynamicAttributeDynamicValueParams): void {
    this.checkValueNodes(valueNodes)
  }

  private checkValueNodes(nodes: Node[]): void {
    for (const node of nodes) {
      if (!isERBNode(node)) continue

      if (node.tag_opening?.value === "<%==") {
        this.addOffense(
          "Avoid `<%==` in attribute values. Use `<%= %>` instead to ensure proper HTML escaping.",
          node.location,
        )
      }
    }
  }
}

export class ERBNoRawOutputInAttributeValueRule extends ParserRule {
  static ruleName = "erb-no-raw-output-in-attribute-value"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoRawOutputInAttributeValueVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
