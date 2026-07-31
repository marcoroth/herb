import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBEndNode, ERBIterationBlockNode, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ERBNoOutputControlFlowRuleVisitor extends BaseRuleVisitor {
  visitERBIfNode(node: ERBIfNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBEndNode(node: ERBEndNode): void {
    this.checkOutputControlFlow(node)
    this.visitChildNodes(node)
  }

  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
    this.checkOutputIterationBlock(node)
    this.visitChildNodes(node)
  }

  private checkOutputIterationBlock(node: ERBIterationBlockNode): void {
    const openTag = node.tag_opening

    if (!openTag) return
    if (openTag.value !== "<%=") return

    const method = node.message?.value ?? "each"

    const content = node.content?.value ?? " "
    const tagClosing = node.tag_closing?.value ?? "%>"
    const suggestion = `<%${content}${tagClosing}`.replace(/\s*\n\s*/g, " ")

    this.addOffense(
      `Iteration blocks like \`${method}\` should not be used with output tags, they return the collection instead of the rendered output. Use \`${suggestion}\` instead.`,
      openTag.location,
    )
  }

  private static readonly CONTROL_BLOCK_NAMES: Record<string, string> = {
    "AST_ERB_IF_NODE": "if",
    "AST_ERB_ELSE_NODE": "else",
    "AST_ERB_END_NODE": "end",
    "AST_ERB_UNLESS_NODE": "unless"
  }

  private checkOutputControlFlow(controlBlock: ERBIfNode | ERBUnlessNode | ERBElseNode | ERBEndNode): void {
    const openTag = controlBlock.tag_opening;
    if (!openTag) {
      return
    }

    if (openTag.value === "<%="){
      const controlBlockType = ERBNoOutputControlFlowRuleVisitor.CONTROL_BLOCK_NAMES[controlBlock.type] || controlBlock.type

      this.addOffense(
        `Control flow statements like \`${controlBlockType}\` should not be used with output tags. Use \`<% ${controlBlockType} ... %>\` instead.`,
        openTag.location,
      )
    }
  }
}

export class ERBNoOutputControlFlowRule extends ParserRule {
  static ruleName = "erb-no-output-control-flow"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoOutputControlFlowRuleVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
