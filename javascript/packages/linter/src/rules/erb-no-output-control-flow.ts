import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { ParseResult, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBEndNode, ERBIterationBlockNode, ERBBlockNode, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

type OutputControlFlowNode = ERBIfNode | ERBUnlessNode | ERBElseNode | ERBEndNode | ERBIterationBlockNode | ERBBlockNode

interface ERBNoOutputControlFlowAutofixContext extends BaseAutofixContext {
  node: Mutable<OutputControlFlowNode>
}

class ERBNoOutputControlFlowRuleVisitor extends BaseRuleVisitor<ERBNoOutputControlFlowAutofixContext> {
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
      { node: node as Mutable<ERBIterationBlockNode>, nodeType: "AST_ERB_BLOCK_NODE" },
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
      const content = controlBlock.content?.value ?? ""
      const collapsedContent = content.replace(/\s*\n\s*/g, " ")
      const keyword = collapsedContent.trim().split(/\s+/)[0] || ERBNoOutputControlFlowRuleVisitor.CONTROL_BLOCK_NAMES[controlBlock.type] || controlBlock.type

      const tagClosing = controlBlock.tag_closing?.value ?? "%>"
      const suggestion = collapsedContent ? `<%${collapsedContent}${tagClosing}` : `<% ${keyword} ... ${tagClosing}`

      this.addOffense(
        `Control flow statements like \`${keyword}\` should not be used with output tags. Use \`${suggestion}\` instead.`,
        openTag.location,
        { node: controlBlock as Mutable<OutputControlFlowNode> },
      )
    }
  }
}

export class ERBNoOutputControlFlowRule extends ParserRule<ERBNoOutputControlFlowAutofixContext> {
  static ruleName = "erb-no-output-control-flow"
  static introducedIn = this.version("0.4.0")
  static autocorrectable = true

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

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBNoOutputControlFlowAutofixContext>[] {
    const visitor = new ERBNoOutputControlFlowRuleVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBNoOutputControlFlowAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (!node.tag_opening) return null
    if (node.tag_opening.value !== "<%=") return null

    node.tag_opening.value = "<%"

    return result
  }
}
