import { ParserRule } from "../types.js"
import { HerbCounterCommentBaseVisitor } from "./herb-counter-comment-base.js"
import { parseHerbCounterContent } from "../herb-counter-comment-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

class HerbCounterCommentMalformedVisitor extends HerbCounterCommentBaseVisitor {
  protected checkHerbCounterComment(node: ERBContentNode, content: string): void {
    const trimmed = content.trim()
    if (!trimmed.startsWith("herb:counter")) return

    if (trimmed.length > "herb:counter".length) {
      const charAfterPrefix = trimmed["herb:counter".length]

      if (charAfterPrefix !== ' ' && charAfterPrefix !== '\t' && charAfterPrefix !== '\n') {
        this.addOffense(
          "`herb:counter` comment is missing a space after `herb:counter`. Add a space before the rule name.",
          node.location,
        )

        return
      }
    }

    const afterPrefix = trimmed.substring("herb:counter".length).trim()
    if (afterPrefix.length === 0) {
      this.addOffense(
        "`herb:counter` comment is missing a rule name and count. Expected `herb:counter <RuleName> <count>`.",
        node.location,
      )
      return
    }

    const parsed = parseHerbCounterContent(content)
    if (parsed !== null) return

    const parts = afterPrefix.split(/\s+/)

    let message = "`herb:counter` comment is malformed. Expected `herb:counter <RuleName> <count>`."

    if (parts.length === 1) {
      message = "`herb:counter` comment is missing a count. Expected `herb:counter <RuleName> <count>` with a non-negative integer count."
    } else if (parts.length > 2) {
      message = "`herb:counter` comment has extra content after the count. Expected exactly `herb:counter <RuleName> <count>`."
    } else if (parts.length === 2 && !/^\d+$/.test(parts[1])) {
      message = `\`herb:counter\` comment has an invalid count \`${parts[1]}\`. The count must be a non-negative integer.`
    }

    this.addOffense(message, node.location)
  }
}

export class HerbCounterCommentMalformedRule extends ParserRule {
  static ruleName = "herb-counter-comment-malformed"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbCounterCommentMalformedVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
