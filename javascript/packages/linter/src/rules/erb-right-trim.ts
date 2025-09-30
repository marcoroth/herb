import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { LintOffense, LintContext } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

class ERBRightTrimVisitor extends BaseRuleVisitor {
  
  visitERBContentNode(node: ERBContentNode): void {
    if (!node.tag_closing) {
      return
    }

    if (!node.content?.value) {
      return
    }

    if (node.tag_closing.value === "=%>") {
      this.addOffense(
        "Prefer -%> instead of =%> for trimming on the right",
        node.location
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
