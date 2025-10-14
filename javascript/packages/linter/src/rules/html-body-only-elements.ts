import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, isBodyOnlyTag } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

class HTMLBodyOnlyElementsVisitor extends BaseRuleVisitor {
  private isInHead = false

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node.open_tag)
    if (!tagName) return

    const previousIsInHead = this.isInHead
    if (tagName.toLowerCase() === "head") this.isInHead = true

    if (this.isInHead && isBodyOnlyTag(tagName)) {
      this.addOffense(
        `Element \`<${tagName}>\` must be placed inside the \`<body>\` tag.`,
        node.location,
        "error"
      )
    }

    this.visitChildNodes(node)

    this.isInHead = previousIsInHead
  }
}

export class HTMLBodyOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  name = "html-body-only-elements"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLBodyOnlyElementsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
