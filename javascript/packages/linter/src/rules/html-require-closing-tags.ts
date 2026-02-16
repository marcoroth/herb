import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

import { BaseRuleVisitor, getTagName } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class RequireClosingTagsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkClosingTag(node)
    super.visitHTMLElementNode(node)
  }

  private checkClosingTag(node: HTMLElementNode): void {
    if (!node.open_tag) return
    if (node.close_tag?.type !== "AST_HTML_OMITTED_CLOSE_TAG_NODE") return

    const tagName = getTagName(node)
    if (!tagName) return

    this.addOffense(
      `Missing explicit closing tag for \`<${tagName}>\`. Use \`</${tagName}>\` instead of relying on implicit tag closing.`,
      node.open_tag.location
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
