import { HTMLOpenTagNode, HTMLElementNode, Visitor, Node } from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

class BlockInsideInlineVisitor extends Visitor {
  private inlineStack: string[] = []
  private messages: LintMessage[] = []
  private ruleName: string

  private inlineElements = new Set([
    "a", "abbr", "acronym", "b", "bdo", "big", "br", "button", "cite", "code",
    "dfn", "em", "i", "img", "input", "kbd", "label", "map", "object", "output",
    "q", "samp", "script", "select", "small", "span", "strong", "sub", "sup",
    "textarea", "time", "tt", "var"
  ])

  private blockElements = new Set([
    "address", "article", "aside", "blockquote", "canvas", "dd", "div", "dl",
    "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2",
    "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "noscript",
    "ol", "p", "pre", "section", "table", "tfoot", "ul", "video"
  ])

  constructor(ruleName: string) {
    super()
    this.ruleName = ruleName
  }

  getMessages(): LintMessage[] {
    return this.messages
  }

  private isValidHTMLOpenTag(node: HTMLElementNode): boolean {
    return !!(node.open_tag && node.open_tag.type === "AST_HTML_OPEN_TAG_NODE")
  }

  private getElementType(tagName: string): { isInline: boolean; isBlock: boolean; isUnknown: boolean } {
    const isInline = this.inlineElements.has(tagName)
    const isBlock = this.blockElements.has(tagName)
    const isUnknown = !isInline && !isBlock
    return { isInline, isBlock, isUnknown }
  }

  private addViolationMessage(tagName: string, isBlock: boolean, openTag: HTMLOpenTagNode): void {
    const parentInline = this.inlineStack[this.inlineStack.length - 1]
    const elementType = isBlock ? "Block-level" : "Unknown"

    this.messages.push({
      rule: this.ruleName,
      message: `${elementType} element \`<${tagName}>\` cannot be placed inside inline element \`<${parentInline}>\`.`,
      location: openTag.tag_name!.location,
      severity: "error"
    })
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
    } else {
      this.visitBlockElement(node)
    }
  }
}

export class HTMLNoBlockInsideInlineRule implements Rule {
  name = "html-no-block-inside-inline"
  description = "Prevent block-level elements from being placed inside inline elements"

  check(node: Node): LintMessage[] {
    const visitor = new BlockInsideInlineVisitor(this.name)
    visitor.visit(node)
    return visitor.getMessages()
  }
}
