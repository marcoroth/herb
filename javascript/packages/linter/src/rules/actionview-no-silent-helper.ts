import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOutputNode, PrismVisitor } from "@herb-tools/core"
import { isActionViewHelperCall } from "./action-view-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBNode, ParserOptions, PrismNode } from "@herb-tools/core"

class ActionViewHelperCallCollector extends PrismVisitor {
  public readonly matches: { helperName: string }[] = []

  visitCallNode(node: PrismNode): void {
    const match = isActionViewHelperCall(node)

    if (match) {
      this.matches.push(match)
    }

    this.visitChildNodes(node)
  }
}

class ActionViewNoSilentHelperVisitor extends BaseRuleVisitor {
  visitERBNode(node: ERBNode): void {
    this.checkSilentHelper(node)
    super.visitERBNode(node)
  }

  private checkSilentHelper(node: ERBNode): void {
    if (isERBOutputNode(node)) return

    const tagOpening = node.tag_opening?.value
    if (!tagOpening) return
    if (tagOpening.startsWith("<%%")) return

    const prismNode = (node as any).prismNode
    if (!prismNode) return

    const collector = new ActionViewHelperCallCollector()
    collector.visit(prismNode)

    for (const match of collector.matches) {
      this.addOffense(
        `Avoid using \`${tagOpening} %>\` with \`${match.helperName}\`. Use \`<%= %>\` to ensure the helper's output is rendered.`,
        node.location,
      )
    }
  }
}

export class ActionViewNoSilentHelperRule extends ParserRule {
  static ruleName = "actionview-no-silent-helper"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoSilentHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
