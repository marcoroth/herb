import { ParserRule } from "../types.js"
import { PrismVisitor } from "@herb-tools/core"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isERBOutputNode, isRubyParameterNode, isPrismNodeType } from "@herb-tools/core"
import { isAssignmentNode, isDebugOutputCall, isCallOnLocal } from "./prism-rule-utils.js"
import { locationFromOffset } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ERBRenderNode, ParserOptions, PrismNode } from "@herb-tools/core"

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
  "assert_valid_keys",
])

const SIDE_EFFECT_METHODS = new Set([
  "content_for",
  "provide",
  "flush",
  "turbo_refreshes_with",
  "turbo_exempts_page_from_cache",
  "turbo_exempts_page_from_preview",
  "turbo_page_requires_reload",
])

class UnusedExpressionCollector extends PrismVisitor {
  public readonly expressions: PrismNode[] = []
  private readonly blockLocalNames: Set<string>

  constructor(blockLocalNames: Set<string> = new Set()) {
    super()

    this.blockLocalNames = blockLocalNames
  }

  override visit(node: PrismNode): void {
    if (!node) return

    if (isPrismNodeType(node, "ProgramNode") || isPrismNodeType(node, "StatementsNode")) {
      super.visit(node)
      return
    }

    if (isAssignmentNode(node)) return

    if (this.isUnusedExpression(node)) {
      this.expressions.push(node)
    }
  }

  private isMutationCall(node: PrismNode): boolean {
    if (node.name.endsWith("!")) return true

    return MUTATION_METHODS.has(node.name)
  }

  private isSideEffectCall(node: PrismNode): boolean {
    if (node.receiver) return false

    return SIDE_EFFECT_METHODS.has(node.name)
  }

  private isUnusedExpression(node: PrismNode): boolean {
    if (isPrismNodeType(node, "CallNode")) {
      if (node.block) return false
      if (this.isMutationCall(node)) return false
      if (this.isSideEffectCall(node)) return false
      if (isDebugOutputCall(node)) return false
      if (this.blockLocalNames.size > 0 && isCallOnLocal(node, this.blockLocalNames)) return false

      return true
    }

    return (
      isPrismNodeType(node, "InstanceVariableReadNode") ||
      isPrismNodeType(node, "ClassVariableReadNode") ||
      isPrismNodeType(node, "GlobalVariableReadNode") ||
      isPrismNodeType(node, "LocalVariableReadNode") ||
      isPrismNodeType(node, "ConstantReadNode") ||
      isPrismNodeType(node, "ConstantPathNode")
    )
  }
}

class ERBNoUnusedExpressionsVisitor extends BaseRuleVisitor {
  private renderBlockLocalNames: Set<string> = new Set()

  visitERBRenderNode(node: ERBRenderNode): void {
    const previousLocalNames = this.renderBlockLocalNames
    const localNames = new Set(previousLocalNames)

    for (const argument of node.block_arguments) {
      if (isRubyParameterNode(argument)) {
        const name = argument.name?.value

        if (name) {
          localNames.add(name)
        }
      }
    }

    this.renderBlockLocalNames = localNames
    this.visitChildNodes(node)
    this.renderBlockLocalNames = previousLocalNames
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const collector = new UnusedExpressionCollector(this.renderBlockLocalNames)
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
  static introducedIn = this.version("0.9.3")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      }
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
