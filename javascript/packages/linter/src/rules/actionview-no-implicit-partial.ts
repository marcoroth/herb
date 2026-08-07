import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { constructsObject, isOutputRender, isStaticPartialPath, renderPartialExpression, rootReceiver } from "./prism-rule-utils.js"

import { isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class ActionViewNoImplicitPartialVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    const call = node.prismNode
    const source = node.source

    if (!call || !source) return
    if (!isOutputRender(node)) return

    const expression = renderPartialExpression(call)

    if (!expression) return
    if (expression.explicit) return
    if (isStaticPartialPath(expression.node)) return
    if (isPrismNodeType(expression.node, "InterpolatedStringNode")) return
    if (this.isRenderableObject(expression.node)) return

    const object = node.keywords?.object?.value

    this.addOffense(
      `Rails derives the partial from \`to_partial_path\`${object ? ` on \`${object}\`` : ""} when the template renders, so the template this renders is not named in this \`<%= render %>\` call. Name it explicitly, with \`object:\` for a single record or \`collection:\` for many, and Herb can take you to it, check the locals you pass against its strict locals, and help you rename them.`,
      locationFromByteOffset(source, expression.node.location.startOffset, expression.node.location.length),
    )
  }

  private isRenderableObject(node: PrismNode): boolean {
    if (constructsObject(node)) return true

    const root = rootReceiver(node)

    return isPrismNodeType(root, "ConstantReadNode") || isPrismNodeType(root, "ConstantPathNode")
  }
}

export class ActionViewNoImplicitPartialRule extends ParserRule {
  static ruleName = "actionview-no-implicit-partial"
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
    const visitor = new ActionViewNoImplicitPartialVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
