import { BaseRuleVisitor, isInlineElement, isBlockElement } from "./rule-utils.js"

import type { Rule, LintMessage } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, Node } from "@herb-tools/core"

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

  private addViolationMessage(tagName: string, isBlock: boolean, openTag: HTMLOpenTagNode): void {
    const parentInline = this.inlineStack[this.inlineStack.length - 1]
    const elementType = isBlock ? "Block-level" : "Unknown"

    this.addMessage(
      `${elementType} element \`<${tagName}>\` cannot be placed inside inline element \`<${parentInline}>\`.`,
      openTag.tag_name!.location,
      "error"
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
      this.addViolationMessage(tagName, isBlock, openTag)
    }

    if (isInline) {
      this.visitInlineElement(node, tagName)
      return
    }

    this.visitBlockElement(node)
  }
}

export class HTMLNoBlockInsideInlineRule implements Rule {
  name = "html-no-block-inside-inline"

  check(node: Node): LintMessage[] {
    const visitor = new BlockInsideInlineVisitor(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
