import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isERBOutputNode } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"
import type { ERBNode, ParseResult } from "@herb-tools/core"

class ERBRightTrimVisitor extends BaseRuleVisitor {
  visitERBNode(node: ERBNode): void {
    if (!node.tag_closing) return

    const trimClosing = node.tag_closing.value

    if (trimClosing !== "=%>" && trimClosing !== "-%>") return

    if (!isERBOutputNode(node)) {
      this.addOffense(
        `Right-trimming with \`${trimClosing}\` has no effect on non-output ERB tags. Use \`%>\` instead`,
        node.tag_closing.location
      )

      return
    }

    if (trimClosing === "=%>") {
      this.addOffense(
        "Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines",
        node.tag_closing.location
      )
    }
  }
}

export class ERBRightTrimRule extends ParserRule {
  name = "erb-right-trim"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBRightTrimVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
