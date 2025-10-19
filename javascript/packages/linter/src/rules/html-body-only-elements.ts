import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, isBodyOnlyTag } from "./rule-utils.js"

import type { LintOffense, LintContext } from "../types.js"
import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

class HTMLBodyOnlyElementsVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node.open_tag)?.toLowerCase()
    if (!tagName) return

    this.checkBodyOnlyElement(node, tagName)

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()
  }

  private checkBodyOnlyElement(node: HTMLElementNode, tagName: string): void {
    if (this.insideBody) return
    if (!this.insideHead) return
    if (!isBodyOnlyTag(tagName)) return

    this.addOffense(
      `Element \`<${tagName}>\` must be placed inside the \`<body>\` tag.`,
      node.location,
      "error"
    )
  }

  private get insideBody(): boolean {
    return this.elementStack.includes("body")
  }

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }
}

export class HTMLBodyOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  name = "html-body-only-elements"

  isEnabled(_result: ParseResult, context?: Partial<LintContext>): boolean {
    if (context?.fileName?.endsWith(".xml")) return false
    if (context?.fileName?.endsWith(".xml.erb")) return false

    return true
  }

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLBodyOnlyElementsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
