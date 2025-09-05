import { BaseRuleVisitor, getTagName } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, ParseResult } from "@herb-tools/core"

export const BODY_ONLY_ELEMENTS = new Set([
  "header", "main", "nav", "section", "footer", "article", "aside", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "table"
])

class BodyOnlyElementsVisitor extends BaseRuleVisitor {
  private isInBody: boolean = false

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!node.open_tag || node.open_tag.type !== "AST_HTML_OPEN_TAG_NODE") {
      super.visitHTMLElementNode(node)
      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = getTagName(openTag)

    if (!tagName) {
      super.visitHTMLElementNode(node)
      return
    }

    const lowerTagName = tagName.toLowerCase()
    const wasInBody = this.isInBody

    if (lowerTagName === "body") {
      this.isInBody = true
    }

    if (BODY_ONLY_ELEMENTS.has(lowerTagName) && !this.isInBody) {
      this.addOffense(
        `Element \`<${tagName}>\` must be placed inside the \`<body>\` tag.`,
        openTag.tag_name!.location,
        "error"
      )
    }

    super.visitHTMLElementNode(node)

    this.isInBody = wasInBody
  }
}

export class HTMLBodyOnlyElementsRule extends ParserRule {
  name = "html-body-only-elements"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new BodyOnlyElementsVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}