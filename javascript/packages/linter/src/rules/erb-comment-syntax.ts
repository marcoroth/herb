import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

class ERBCommentSyntaxVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    const content = node.content?.value || ""

    if (content.match(/^ +#/)) {
      const openingTag = node.tag_opening?.value

      if (content.includes("herb:disable")) {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\` for \`herb:disable\` directives. Herb directives only work with ERB comment syntax (\`<%# ... %>\`).`,
          node.location
        )
      } else {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\`. Ruby comments immediately after ERB tags can cause parsing issues.`,
          node.location
        )
      }
    }
  }
}

export class ERBCommentSyntax extends ParserRule {
  name = "erb-comment-syntax"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBCommentSyntaxVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
