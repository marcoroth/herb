import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOmittedCloseTagNode, ParseResult, ParserOptions } from "@herb-tools/core"

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
  static autocorrectable = false
  static ruleName = "html-require-closing-tags"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { strict: false }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new RequireClosingTagsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
