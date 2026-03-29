import { ParserRule } from "../types.js"
import { PrismVisitor } from "@herb-tools/core"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isERBOutputNode } from "@herb-tools/core"
import { isAssignmentNode, isDebugOutputCall } from "./prism-rule-utils.js"
import { locationFromOffset } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

const MUTATION_METHODS = new Set([
  "<<",
  "[]=",
  "push",
  "append",
  "prepend",
  "pop",
  "shift",
  "unshift",
  "delete",
  "clear",
  "replace",
  "insert",
  "concat",
])

class UnusedExpressionCollector extends PrismVisitor {
  public readonly expressions: PrismNode[] = []

  override visit(node: PrismNode): void {
    if (!node) return

    const type: string = node.constructor?.name ?? ""

    if (type === "ProgramNode" || type === "StatementsNode") {
      super.visit(node)
      return
    }

    if (isAssignmentNode(node)) return

    if (this.isUnusedExpression(node, type)) {
      this.expressions.push(node)
    }
  }

  private isMutationCall(node: PrismNode): boolean {
    if (node.name.endsWith("!")) return true

    return MUTATION_METHODS.has(node.name)
  }

  private isUnusedExpression(node: PrismNode, type: string): boolean {
    if (type === "CallNode") {
      if (node.block) return false
      if (this.isMutationCall(node)) return false
      if (isDebugOutputCall(node)) return false

      return true
    }

    return (
      type === "InstanceVariableReadNode" ||
      type === "ClassVariableReadNode" ||
      type === "GlobalVariableReadNode" ||
      type === "LocalVariableReadNode" ||
      type === "ConstantReadNode" ||
      type === "ConstantPathNode"
    )
  }
}

class ERBNoUnusedExpressionsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const collector = new UnusedExpressionCollector()
    collector.visit(prismNode)

    for (const expression of collector.expressions) {
      const { startOffset, length } = expression.location
      const expressionSource = source.substring(startOffset, startOffset + length)
      const location = locationFromOffset(source, startOffset, length)

      this.addOffense(
        `Avoid unused expressions in silent ERB tags. \`${expressionSource}\` is evaluated but its return value is discarded. Use \`<%= ... %>\` to output the value or remove the expression.`,
        location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }
}

export class ERBNoUnusedExpressionsRule extends ParserRule {
  static ruleName = "erb-no-unused-expressions"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
      render_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnusedExpressionsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
