import { HTMLOpenTagNode, HTMLElementNode, Visitor, Node } from "@herb-tools/core"
import { Rule, LintMessage } from "../types.js"

class NestedLinkVisitor extends Visitor {
  private linkStack: HTMLOpenTagNode[] = []
  private messages: LintMessage[] = []
  private ruleName: string

  constructor(ruleName: string) {
    super()
    this.ruleName = ruleName
  }

  getMessages(): LintMessage[] {
    return this.messages
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    // Check if this is a link element
    if (node.open_tag && node.open_tag.type === "AST_HTML_OPEN_TAG_NODE") {
      const openTag = node.open_tag as HTMLOpenTagNode
      if (openTag.tag_name?.value.toLowerCase() === "a") {
        // If we're already inside a link, this is a nested link
        if (this.linkStack.length > 0) {
          this.messages.push({
            rule: this.ruleName,
            message: "Nested <a> elements are not allowed. Links cannot contain other links.",
            location: openTag.tag_name.location,
            severity: "error"
          })
        }

        // Add this link to the stack
        this.linkStack.push(openTag)

        // Visit children
        super.visitHTMLElementNode(node)

        // Remove this link from the stack when done
        this.linkStack.pop()
      } else {
        // Not a link, just continue traversing
        super.visitHTMLElementNode(node)
      }
    } else {
      // Not a proper element, just continue traversing
      super.visitHTMLElementNode(node)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    // Handle self-closing <a> tags (though they're not valid HTML, they might exist)
    if (node.tag_name?.value.toLowerCase() === "a" && node.is_void) {
      if (this.linkStack.length > 0) {
        this.messages.push({
          rule: this.ruleName,
          message: "Nested <a> elements are not allowed. Links cannot contain other links.",
          location: node.tag_name.location,
          severity: "error"
        })
      }
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export class HTMLNoNestedLinksRule implements Rule {
  name = "html-no-nested-links"
  description = "Disallow placing one <a> element inside another <a> element"

  check(node: Node): LintMessage[] {
    const visitor = new NestedLinkVisitor(this.name)
    visitor.visit(node)
    return visitor.getMessages()
  }
}
