import { ParserRule } from "../types.js"
import { HerbCounterCommentParsedVisitor } from "./herb-counter-comment-base.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbCounterComment } from "../herb-counter-comment-utils.js"

/**
 * Report every occurrence of a rule that has more than one
 * `<%# herb:counter RULE N %>` comment in the same file. Semantics match
 * `herb-disable-comment-no-duplicate-rules` for its family.
 */
class HerbCounterCommentNoDuplicateRulesVisitor extends HerbCounterCommentParsedVisitor {
  private seen = new Map<string, ERBContentNode>()

  protected checkParsedHerbCounter(node: ERBContentNode, _content: string, herbCounter: HerbCounterComment): void {
    const first = this.seen.get(herbCounter.ruleName)

    if (!first) {
      this.seen.set(herbCounter.ruleName, node)
      return
    }

    this.addOffense(
      `Duplicate \`herb:counter\` comment for rule \`${herbCounter.ruleName}\`. Only one \`herb:counter\` comment is allowed per rule per file.`,
      node.location,
    )
  }
}

export class HerbCounterCommentNoDuplicateRulesRule extends ParserRule {
  static ruleName = "herb-counter-comment-no-duplicate-rules"
  static introducedIn = this.version("0.10.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbCounterCommentNoDuplicateRulesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
