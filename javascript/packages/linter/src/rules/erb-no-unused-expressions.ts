import { ParserRule } from "../types.js"
import { PrismVisitor, substringFromByteOffset , locationFromByteOffset } from "@herb-tools/core"
import { BaseRuleVisitor } from "../utils/rule-utils.js"

import { isERBOutputNode, isRubyParameterNode, isPrismNodeType } from "@herb-tools/core"
import { isAssignmentNode, isDebugOutputCall, isSleepCall, isCallOnLocal, SIDE_EFFECT_METHODS } from "../utils/prism-rule-utils.js"
import { StateScopeMap } from "../utils/state-directives-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ERBRenderNode, ERBBlockNode, ParserOptions, PrismNode } from "@herb-tools/core"

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

class UnusedExpressionCollector extends PrismVisitor {
  public readonly expressions: PrismNode[] = []
  private readonly blockLocalNames: Set<string>
  private readonly stateNames: Set<string>

  constructor(blockLocalNames: Set<string> = new Set(), stateNames: Set<string> = new Set()) {
    super()

    this.blockLocalNames = blockLocalNames
    this.stateNames = stateNames
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

  private isStateRead(node: PrismNode): boolean {
    if (this.stateNames.size === 0) return false
    if (node.receiver || node.block) return false
    if (node.arguments_?.arguments_?.length) return false

    const spelled = String(node.name)
    const name = spelled.endsWith("?") ? spelled.slice(0, -1) : spelled

    return this.stateNames.has(name)
  }

  private isUnusedExpression(node: PrismNode): boolean {
    if (isPrismNodeType(node, "CallNode")) {
      if (node.block) return false
      if (this.isMutationCall(node)) return false
      if (this.isSideEffectCall(node)) return false
      if (isDebugOutputCall(node)) return false
      if (isSleepCall(node)) return false
      if (this.isStateRead(node)) return false
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
  private exemptLocalNames: Set<string> = new Set()
  private states: StateScopeMap
  private scopeStack: (ERBBlockNode | null)[] = [null]

  constructor(ruleName: string, states: StateScopeMap, context?: Partial<LintContext>) {
    super(ruleName, context)

    this.states = states
  }

  visitERBRenderNode(node: ERBRenderNode): void {
    this.visitExemptingBlockArguments(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.scopeStack.push(node)

    const prismNode = node.prismNode

    if (prismNode && this.isSlotSetterCall(prismNode)) {
      this.visitExemptingBlockArguments(node)
    } else {
      this.visitChildNodes(node)
    }

    this.scopeStack.pop()
  }

  private isSlotSetterCall(node: PrismNode): boolean {
    return isPrismNodeType(node, "CallNode") && Boolean(node.receiver) && node.name.startsWith("with_")
  }

  private visitExemptingBlockArguments(node: ERBRenderNode | ERBBlockNode): void {
    const previousLocalNames = this.exemptLocalNames
    const localNames = new Set(previousLocalNames)

    for (const argument of node.block_arguments) {
      if (isRubyParameterNode(argument)) {
        const name = argument.name?.value

        if (name) {
          localNames.add(name)
        }
      }
    }

    this.exemptLocalNames = localNames
    this.visitChildNodes(node)
    this.exemptLocalNames = previousLocalNames
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const collector = new UnusedExpressionCollector(this.exemptLocalNames, new Set(this.states.namesIn(this.scopeStack)))
    collector.visit(prismNode)

    const tagOpening = node.tag_opening?.value ?? "<%"
    const tagClosing = node.tag_closing?.value ?? "%>"

    for (const expression of collector.expressions) {
      const { startOffset, length } = expression.location
      const expressionSource = substringFromByteOffset(source, startOffset, length)
      const location = locationFromByteOffset(source, startOffset, length)

      const collapsedExpression = expressionSource.replace(/\s*\n\s*/g, " ")
      const tag = `${tagOpening} ${collapsedExpression} ${tagClosing}`
      const suggestion = `<%= ${collapsedExpression} ${tagClosing}`

      this.addOffense(
        `Avoid unused expressions in silent ERB tags. \`${tag}\` is evaluated but its return value is discarded. Use \`${suggestion}\` to output the value or remove the expression.`,
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
    const visitor = new ERBNoUnusedExpressionsVisitor(this.ruleName, StateScopeMap.collect(result.value), context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
