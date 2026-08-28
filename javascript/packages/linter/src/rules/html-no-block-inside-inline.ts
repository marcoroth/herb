import { BaseRuleVisitor, isInlineElement, isBlockElement } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"
import { isHTMLOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, ParseResult } from "@herb-tools/core"

const SVG_HTML_INTEGRATION_POINTS = new Set(["foreignobject", "desc", "title"])

// TODO: refactor using ElementStackVisitor
class BlockInsideInlineVisitor extends BaseRuleVisitor {
  private inlineStack: string[] = []
  private insideSVG = false

  private getElementType(tagName: string): { isInline: boolean; isBlock: boolean; isUnknown: boolean } {
    const isInline = isInlineElement(tagName)
    const isBlock = isBlockElement(tagName)
    const isUnknown = !isInline && !isBlock

    return { isInline, isBlock, isUnknown }
  }

  private addOffenseMessage(tagName: string, isBlock: boolean, openTag: HTMLOpenTagNode): void {
    const parentInline = this.inlineStack[this.inlineStack.length - 1]
    const elementType = isBlock ? "Block-level" : "Unknown"

    this.addOffense(
      `${elementType} element \`<${tagName}>\` cannot be placed inside inline element \`<${parentInline}>\`.`,
      openTag.tag_name!.location,
    )
  }

  private visitInlineElement(node: HTMLElementNode, tagName: string): void {
    this.inlineStack.push(tagName)
    super.visitHTMLElementNode(node)
    this.inlineStack.pop()
  }

  private visitBlockElement(node: HTMLElementNode): void {
    const savedStack = [...this.inlineStack]
    this.inlineStack = []
    super.visitHTMLElementNode(node)
    this.inlineStack = savedStack
  }

  private visitSVGElement(node: HTMLElementNode): void {
    const savedStack = this.inlineStack
    const wasInsideSVG = this.insideSVG

    this.inlineStack = []
    this.insideSVG = true
    super.visitHTMLElementNode(node)
    this.insideSVG = wasInsideSVG
    this.inlineStack = savedStack
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) {
      super.visitHTMLElementNode(node)
      return
    }

    const tagName = node.open_tag.tag_name?.value.toLowerCase()

    if (!tagName) {
      super.visitHTMLElementNode(node)
      return
    }

    if (this.insideSVG) {
      if (SVG_HTML_INTEGRATION_POINTS.has(tagName)) {
        this.insideSVG = false
        super.visitHTMLElementNode(node)
        this.insideSVG = true
        return
      }

      super.visitHTMLElementNode(node)
      return
    }

    if (tagName === "svg") {
      this.visitSVGElement(node)
      return
    }

    const { isInline, isBlock, isUnknown } = this.getElementType(tagName)

    if ((isBlock || isUnknown) && this.inlineStack.length > 0) {
      this.addOffenseMessage(tagName, isBlock, node.open_tag)
    }

    if (isInline) {
      this.visitInlineElement(node, tagName)
      return
    }

    this.visitBlockElement(node)
  }
}

export class HTMLNoBlockInsideInlineRule extends ParserRule {
  static ruleName = "html-no-block-inside-inline"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new BlockInsideInlineVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
