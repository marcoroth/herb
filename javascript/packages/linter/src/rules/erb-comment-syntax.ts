import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

class ERBCommentSyntaxVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (node.content?.value.startsWith(" #")) {
      const openingTag = node.tag_opening?.value

      this.addOffense(
        `Use \`<%#\` instead of \`${openingTag} #\`. Ruby comments immediately after ERB tags can cause parsing issues.`,
        node.location
      )
    }
  }
}

export class ERBCommentSyntax extends ParserRule {
  name = "erb-comment-syntax"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBCommentSyntaxVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
