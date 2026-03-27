import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isTagAttributesCall, isConditionalTagAttributesCall } from "./action-view-utils.js"
import { isERBNode, isERBOutputNode, isERBContentNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLOpenTagNode, ParserOptions } from "@herb-tools/core"

class ERBNoOutputInAttributePositionVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    for (const child of node.children) {
      if (!isERBNode(child)) continue
      if (!isERBOutputNode(child)) continue
      if (!isERBContentNode(child)) continue

      const prismNode = child.prismNode
      if (prismNode && isTagAttributesCall(prismNode)) continue

      if (prismNode && isConditionalTagAttributesCall(prismNode)) {
        this.addOffense(
          "Avoid using conditional `tag.attributes` in attribute position. Use `<% if ... %><%= tag.attributes(...) %><% end %>` instead.",
          child.location,
        )

        continue
      }

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
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoOutputInAttributePositionVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
