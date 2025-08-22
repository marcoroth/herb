import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, isVoidElement } from "./rule-utils.js"

import type { LintContext, LintOffense } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NoSelfClosingVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.tag_closing?.value === "/>") {
      const tagName = getTagName(node)

      const shouldBeVoid = tagName ? isVoidElement(tagName) : false
      const instead = shouldBeVoid ? `Use \`<${tagName}>\` instead.` : `Use \`<${tagName}></${tagName}>\` instead.`

      this.addOffense(
        `Self-closing syntax \`<${tagName} />\` is not allowed in HTML. ${instead}`,
        node.location,
        "error"
      )
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export class HTMLNoSelfClosingRule extends ParserRule {
  name = "html-no-self-closing"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoSelfClosingVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
