import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

function isValidStrictLocalsComment(content: string): boolean {
  return /^locals:\s*\([\s\S]*\)\s*$/.test(content)
}

class ERBStrictLocalsCommentSyntaxVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (node.tag_opening?.value !== "<%#") return

    const content = node.content?.value
    if (!content) return

    const trimmed = content.trim()
    if (!trimmed) return

    const localsPrefix = trimmed.match(/^locals?\b(.*)$/)
    if (!localsPrefix) return

    const remainder = localsPrefix[1]
    if (!/[(:]/.test(remainder)) return

    if (isValidStrictLocalsComment(trimmed)) return

    this.addOffense(
      "Strict locals comments must use `locals: (name:, option: default)` syntax.",
      node.location
    )
  }
}

export class ERBStrictLocalsCommentSyntaxRule extends ParserRule {
  name = "erb-strict-locals-comment-syntax"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBStrictLocalsCommentSyntaxVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
