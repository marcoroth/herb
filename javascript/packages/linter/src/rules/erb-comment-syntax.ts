import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode } from "@herb-tools/core"

interface ERBCommentSyntaxAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBContentNode>
}

class ERBCommentSyntaxVisitor extends BaseRuleVisitor<ERBCommentSyntaxAutofixContext> {
  visitERBContentNode(node: ERBContentNode): void {
    const content = node.content?.value || ""

    if (content.match(/^ +#/)) {
      const openingTag = node.tag_opening?.value

      if (content.includes("herb:disable")) {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\` for \`herb:disable\` directives. Herb directives only work with ERB comment syntax (\`<%# ... %>\`).`,
          node.location,
          { node }
        )
      } else {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\`. Ruby comments immediately after ERB tags can cause parsing issues.`,
          node.location,
          { node }
        )
      }
    }
  }
}

export class ERBCommentSyntax extends ParserRule<ERBCommentSyntaxAutofixContext> {
  static autocorrectable = true
  name = "erb-comment-syntax"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<ERBCommentSyntaxAutofixContext>[] {
    const visitor = new ERBCommentSyntaxVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<ERBCommentSyntaxAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node } = offense.autofixContext

    if (!node.tag_opening) return null
    if (!node.content) return null

    node.tag_opening.value = "<%#"

    const content = node.content.value
    const match = content.match(/^ +(#)/)

    if (match) {
      node.content.value = content.substring(match[0].length)
    }

    return result
  }
}
