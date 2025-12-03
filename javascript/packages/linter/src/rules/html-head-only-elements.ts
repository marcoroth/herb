import { ParserRule } from "../types"
import { BaseRuleVisitor, getTagName, isHeadOnlyTag, hasAttribute } from "./rule-utils"

import type { ParseResult, HTMLElementNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

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
    if (!this.insideBody) return
    if (!isHeadOnlyTag(tagName)) return
    if (tagName === "title" && this.insideSVG) return
    if (tagName === "meta" && this.hasItempropAttribute(node)) return

    this.addOffense(
      `Element \`<${tagName}>\` must be placed inside the \`<head>\` tag.`,
      node.location,
    )
  }

  private hasItempropAttribute(node: HTMLElementNode): boolean {
    return hasAttribute(node.open_tag, "itemprop")
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
  name = "html-head-only-elements"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HeadOnlyElementsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
