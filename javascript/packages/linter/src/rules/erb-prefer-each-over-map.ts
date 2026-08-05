import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOutputNode } from "@herb-tools/core"

import type { ERBIterationBlockNode, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const VALUE_RETURNING_METHODS = ["map", "flat_map", "select", "filter", "reject", "filter_map"]

class PreferEachOverMapVisitor extends BaseRuleVisitor {
  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
    this.checkDiscardedResult(node)

    this.visitChildNodes(node)
  }

  private checkDiscardedResult(node: ERBIterationBlockNode): void {
    if (isERBOutputNode(node)) return

    const method = node.message?.value

    if (!method) return
    if (!VALUE_RETURNING_METHODS.includes(method)) return

    this.addOffense(
      `\`${method}\` builds a new collection that is then discarded. Use \`each\` instead, or output the result with \`<%= %>\`.`,
      node.message!.location,
    )
  }
}

export class ERBPreferEachOverMapRule extends ParserRule {
  static ruleName = "erb-prefer-each-over-map"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new PreferEachOverMapVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
