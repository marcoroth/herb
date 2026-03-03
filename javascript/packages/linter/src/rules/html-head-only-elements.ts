import { ParserRule } from "../types"
import { BaseRuleVisitor, isHeadOnlyTag } from "./rule-utils"
import { hasAttribute, getTagLocalName } from "@herb-tools/core"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

class HeadOnlyElementsVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)
    if (!tagName) return

    this.checkHeadOnlyElement(node, tagName)

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()
  }

  private checkHeadOnlyElement(node: HTMLElementNode, tagName: string): void {
    if (this.insideHead) return
    if (!this.insideBody) return
    if (!isHeadOnlyTag(tagName)) return
    if (tagName === "title" && this.insideSVG) return
    if (tagName === "style" && this.insideSVG) return
    if (tagName === "meta" && this.hasItempropAttribute(node)) return

    this.addOffense(
      `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag.`,
      node.location,
    )
  }

  private hasItempropAttribute(node: HTMLElementNode): boolean {
    return hasAttribute(node, "itemprop")
  }

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }

  private get insideBody(): boolean {
    return this.elementStack.includes("body")
  }

  private get insideSVG(): boolean {
    return this.elementStack.includes("svg")
  }
}

export class HTMLHeadOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  static ruleName = "html-head-only-elements"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
