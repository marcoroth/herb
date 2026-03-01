import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBNode, ParseResult } from "@herb-tools/core"

interface ERBRightTrimAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBNode>
}

class ERBRightTrimVisitor extends BaseRuleVisitor<ERBRightTrimAutofixContext> {
  visitERBNode(node: ERBNode): void {
    if (!node.tag_closing) return

    const trimClosing = node.tag_closing.value

    if (trimClosing !== "=%>") return

    this.addOffense(
      "Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.",
      node.tag_closing.location,
      { node }
    )
  }
}

export class ERBRightTrimRule extends ParserRule<ERBRightTrimAutofixContext> {
  static autocorrectable = true
  name = "erb-right-trim"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBRightTrimAutofixContext>[] {
    const visitor = new ERBRightTrimVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBRightTrimAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (!node.tag_closing) return null

    const closing = node.tag_closing

    if (closing.value === "=%>") {
      closing.value = "-%>"
      return result
    }

    if (closing.value === "-%>") {
      closing.value = "%>"
      return result
    }

    return null
  }
}
