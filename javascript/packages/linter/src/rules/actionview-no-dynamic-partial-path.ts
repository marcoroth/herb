import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isOutputRender, isStaticPartialPath, renderPartialExpression } from "./prism-rule-utils.js"

import { isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class ActionViewNoDynamicPartialPathVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    const call = node.prismNode

    if (!call) return
    if (!isOutputRender(node)) return

    const expression = renderPartialExpression(call)

    if (!expression) return
    if (isStaticPartialPath(expression.node)) return
    if (!expression.explicit && !isPrismNodeType(expression.node, "InterpolatedStringNode")) return

    const source = node.source

    if (!source) return

    this.addOffense(
      `${this.describe(expression.node)} Use a literal name, or branch between literal names, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them.`,
      locationFromByteOffset(source, expression.node.location.startOffset, expression.node.location.length),
    )
  }

  private describe(node: PrismNode): string {
    if (isPrismNodeType(node, "InterpolatedStringNode")) {
      return "The partial name is interpolated, so it is only known at runtime."
    }

    return "The partial name comes from a variable or method call, so it is only known at runtime."
  }
}

export class ActionViewNoDynamicPartialPathRule extends ParserRule {
  static ruleName = "actionview-no-dynamic-partial-path"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoDynamicPartialPathVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
