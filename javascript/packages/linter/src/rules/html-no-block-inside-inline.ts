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

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (node.open_tag && node.open_tag.type === "AST_HTML_OPEN_TAG_NODE") {
      const openTag = node.open_tag as HTMLOpenTagNode
      const tagName = openTag.tag_name?.value.toLowerCase()

      if (tagName) {
        const isInline = this.inlineElements.has(tagName)
        const isBlock = this.blockElements.has(tagName)
        const isUnknown = !isInline && !isBlock

        // Check if this element violates the inline/block rule
        if ((isBlock || isUnknown) && this.inlineStack.length > 0) {
          const parentInline = this.inlineStack[this.inlineStack.length - 1]
          const elementType = isBlock ? "Block-level" : "Unknown"
          this.messages.push({
            rule: this.ruleName,
            message: `${elementType} element \`<${tagName}>\` cannot be placed inside inline element \`<${parentInline}>\`.`,
            location: openTag.tag_name!.location,
            severity: "error"
          })
        }

        // Track inline element nesting
        if (isInline) {
          this.inlineStack.push(tagName)
          super.visitHTMLElementNode(node)
          this.inlineStack.pop()
        } else {
          // Block and unknown elements break the inline context
          const savedStack = [...this.inlineStack]
          this.inlineStack = []
          super.visitHTMLElementNode(node)
          this.inlineStack = savedStack
        }
      } else {
        super.visitHTMLElementNode(node)
      }
    } else {
      super.visitHTMLElementNode(node)
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
