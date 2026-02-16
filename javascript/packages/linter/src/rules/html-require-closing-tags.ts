import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

import { BaseRuleVisitor, getTagName } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class RequireClosingTagsVisitor extends BaseRuleVisitor {
  visitHTMLOmittedCloseTagNode(node: HTMLOmittedCloseTagNode): void {
    const tagName = node.tag_name?.value
    if (!tagName) return

    this.addOffense(
      `Missing explicit closing tag for \`<${tagName}>\`. Use \`</${tagName}>\` instead of relying on implicit tag closing.`,
      node.location
    )
  }
}

export class HTMLRequireClosingTagsRule extends ParserRule {
  name = "html-require-closing-tags"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new RequireClosingTagsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
