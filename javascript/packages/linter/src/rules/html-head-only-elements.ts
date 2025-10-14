import { ParserRule } from "../types"
import { BaseRuleVisitor, getTagName, isHeadOnlyTag } from "./rule-utils"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types"

class HeadOnlyElementsVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node)?.toLowerCase()
    if (!tagName) return

    this.checkHeadOnlyElement(node, tagName)

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()
  }

  private checkHeadOnlyElement(node: HTMLElementNode, tagName: string): void {
    if (this.insideHead) return
    if (!isHeadOnlyTag(tagName)) return
    if (tagName === "title" && this.insideSVG) return

    this.addOffense(
      `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag.`,
      node.location,
      "error"
    )
  }

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }

  private get insideSVG(): boolean {
    return this.elementStack.includes("svg")
  }
}

export class HTMLHeadOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  name = "html-head-only-elements"

  isEnabled(_result: ParseResult, context?: Partial<LintContext>): boolean {
    if (context?.fileName?.endsWith(".xml")) return false
    if (context?.fileName?.endsWith(".xml.erb")) return false

    return true
  }

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
