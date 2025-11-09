import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParseResult, ERBIfNode, ERBUnlessNode, ERBElseNode, ERBEndNode } from "@herb-tools/core"
import { ParserRule } from "../types.js"
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

  private checkOutputControlFlow(controlBlock: ERBIfNode | ERBUnlessNode | ERBElseNode | ERBEndNode): void {
    const openTag = controlBlock.tag_opening;
    if (!openTag) {
      return
    }

    if (openTag.value === "<%="){
      let controlBlockType: string = controlBlock.type

      if (controlBlock.type === "AST_ERB_IF_NODE") controlBlockType = "if"
      if (controlBlock.type === "AST_ERB_ELSE_NODE") controlBlockType = "else"
      if (controlBlock.type === "AST_ERB_END_NODE") controlBlockType = "end"
      if (controlBlock.type === "AST_ERB_UNLESS_NODE") controlBlockType = "unless"

      this.addOffense(
        `Control flow statements like \`${controlBlockType}\` should not be used with output tags. Use \`<% ${controlBlockType} ... %>\` instead.`,
        openTag.location,
      )
    }

    return
  }
}

export class ERBNoOutputControlFlowRule extends ParserRule {
  name = "erb-no-output-control-flow"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoOutputControlFlowRuleVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
