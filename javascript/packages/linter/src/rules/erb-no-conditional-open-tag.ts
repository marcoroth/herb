import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, HTMLConditionalOpenTagNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBNoConditionalOpenTagRuleVisitor extends BaseRuleVisitor {
  visitHTMLConditionalOpenTagNode(node: HTMLConditionalOpenTagNode): void {
    const tagName = node.tag_name?.value || "element"

    this.addOffense(
      `Avoid using ERB conditionals to split the open and closing tag of \`<${tagName}>\` element.`,
      node.location,
    )

    this.visitChildNodes(node)
  }
}

export class ERBNoConditionalOpenTagRule extends ParserRule {
  name = "erb-no-conditional-open-tag"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoConditionalOpenTagRuleVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
