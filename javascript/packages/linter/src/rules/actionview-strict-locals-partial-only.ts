import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isHTMLTextNode } from "@herb-tools/core"
import { isPartialFile } from "./file-utils.js"

import type { ParseResult, ERBStrictLocalsNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

class ActionViewStrictLocalsPartialOnlyVisitor extends BaseRuleVisitor {
  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.addOffense(
      "Strict locals declarations are only supported in partials. This file is not a partial.",
      node.location,
    )
  }
}

export class ActionViewStrictLocalsPartialOnlyRule extends ParserRule {
  static unsafeAutocorrectable = true
  static ruleName = "actionview-strict-locals-partial-only"
  static introducedIn = this.version("0.9.3")

  get parserOptions() {
    return { strict_locals: true }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) !== false) return []

    const visitor = new ActionViewStrictLocalsPartialOnlyVisitor(this.ruleName, context)
    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense, result: ParseResult): ParseResult | null {
    const children = result.value.children

    const index = children.findIndex(child =>
      child.location.start.line === offense.location.start.line &&
      child.location.start.column === offense.location.start.column
    )

    if (index === -1) return null

    children.splice(index, 1)

    if (index < children.length) {
      const next = children[index]

      if (isHTMLTextNode(next) && /^\s*\n/.test(next.content)) {
        children.splice(index, 1)
      }
    }

    return result
  }
}
