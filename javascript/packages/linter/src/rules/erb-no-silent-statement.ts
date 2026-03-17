import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isERBOutputNode, PrismNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions } from "@herb-tools/core"

function isAssignmentNode(prismNode: PrismNode): boolean {
  const type: string = prismNode?.constructor?.name
  if (!type) return false

  return type.endsWith("WriteNode")
}

class ERBNoSilentStatementVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    if (isAssignmentNode(prismNode)) return

    const content = node.content?.value?.trim()
    if (!content) return

    this.addOffense(
      `Avoid using silent ERB tags for statements. Move \`${content}\` to a controller, helper, or presenter.`,
      node.location,
    )
  }
}

export class ERBNoSilentStatementRule extends ParserRule {
  static ruleName = "erb-no-silent-statement"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoSilentStatementVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
