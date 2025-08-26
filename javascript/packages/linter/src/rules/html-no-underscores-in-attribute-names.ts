import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { LintContext, LintOffense } from "../types.js"
import type { ParseResult, HTMLAttributeNameNode } from "@herb-tools/core"
import { getStaticAttributeName } from "@herb-tools/core"

class HTMLNoUnderscoresInAttributeNamesVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNameNode(node: HTMLAttributeNameNode): void {
    const staticName = getStaticAttributeName(node)

    if (!staticName) return

    if (staticName.includes("_")) {
      this.addOffense(
        `HTML attribute name \`${staticName}\` should not contain underscores. Use hyphens (-) instead.`,
        node.location,
        "error"
      )
    }
  }
}

export class HTMLNoUnderscoresInAttributeNamesRule extends ParserRule {
  name = "html-no-underscores-in-attribute-names"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLNoUnderscoresInAttributeNamesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
