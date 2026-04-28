import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOutputNode } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class ActionViewNoSilentRenderVisitor extends BaseRuleVisitor {
  visitERBRenderNode(node: ERBRenderNode): void {
    if (!isERBOutputNode(node)) {
      this.addOffense(
        `Avoid using \`${node.tag_opening?.value} %>\` with \`render\`. Use \`<%= %>\` to ensure the rendered content is output.`,
        node.location,
      )
    }

    this.visitChildNodes(node)
  }
}

export class ActionViewNoSilentRenderRule extends ParserRule {
  static ruleName = "actionview-no-silent-render"
  static introducedIn = this.version("0.9.1")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoSilentRenderVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
