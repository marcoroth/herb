import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ParseResult, HTMLAttributeNode } from "@herb-tools/core"

class HTMLAttributeEqualsSpacingVisitor extends BaseRuleVisitor {
  visitHTMLAttributeNode(attribute: HTMLAttributeNode): void {
    if (!attribute.equals || !attribute.name || !attribute.value) {
      return
    }

    if (attribute.equals.value.startsWith(" ")) {
      this.addOffense(
        "Remove whitespace before `=` in HTML attribute",
        attribute.equals.location,
        "error"
      )
    }

    if (attribute.equals.value.endsWith(" ")) {
      this.addOffense(
        "Remove whitespace after `=` in HTML attribute",
        attribute.equals.location,
        "error"
      )
    }
  }
}

export class HTMLAttributeEqualsSpacingRule extends ParserRule {
  name = "html-attribute-equals-spacing"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLAttributeEqualsSpacingVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
