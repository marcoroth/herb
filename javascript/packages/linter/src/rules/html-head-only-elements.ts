import { BaseRuleVisitor, getTagName, HTML_HEAD_ONLY_ELEMENTS } from "./rule-utils"
import { ParserRule } from "../types"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types"

class HeadOnlyElementsVisitor extends BaseRuleVisitor {
  private isInsideHead = false
  private isInsideSvg = false

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = node.tag_name?.value?.toLowerCase()

    if (tagName === "head") {
      const wasInsideHead = this.isInsideHead
      this.isInsideHead = true
      super.visitHTMLElementNode(node)
      this.isInsideHead = wasInsideHead
    } else if (tagName === "svg") {
      const wasInsideSvg = this.isInsideSvg
      this.isInsideSvg = true
      super.visitHTMLElementNode(node)
      this.isInsideSvg = wasInsideSvg
    } else if (tagName && HTML_HEAD_ONLY_ELEMENTS.has(tagName)) {
      this.checkHeadOnlyElement(node, tagName)
      super.visitHTMLElementNode(node)
    } else {
      super.visitHTMLElementNode(node)
    }
  }

  private checkHeadOnlyElement(node: HTMLElementNode, tagName: string): void {
    if (this.isInsideHead) return
    if (tagName === "title" && this.isInsideSvg) return

    this.addOffense(
      `The \`<${tagName}>\` element should only be used inside the \`<head>\` section.`,
      node.location,
      "error"
    )
  }
}

export class HTMLHeadOnlyElementsRule extends ParserRule {
  name = "html-head-only-elements"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
