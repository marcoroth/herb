import { BaseRuleVisitor, isInlineElement, isBlockElement } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, ParseResult } from "@herb-tools/core"

class BlockInsideInlineVisitor extends BaseRuleVisitor {
  private inlineStack: string[] = []

  private isValidHTMLOpenTag(node: HTMLElementNode): boolean {
    return !!(node.open_tag && node.open_tag.type === "AST_HTML_OPEN_TAG_NODE")
  }

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

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!this.isValidHTMLOpenTag(node)) {
      super.visitHTMLElementNode(node)

      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = openTag.tag_name?.value.toLowerCase()

    if (!tagName) {
      super.visitHTMLElementNode(node)

      return
    }

    const { isInline, isBlock, isUnknown } = this.getElementType(tagName)

    if ((isBlock || isUnknown) && this.inlineStack.length > 0) {
      this.addOffenseMessage(tagName, isBlock, openTag)
    }

    if (isInline) {
      this.visitInlineElement(node, tagName)
      return
    }

    this.visitBlockElement(node)
  }
}

export class HTMLNoBlockInsideInlineRule extends ParserRule {
  name = "html-no-block-inside-inline"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new BlockInsideInlineVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
