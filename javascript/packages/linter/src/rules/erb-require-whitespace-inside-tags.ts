import type { Node, Token} from "@herb-tools/core"
import type { Rule, LintMessage } from "../types.js"
import { BaseRuleVisitor, isERBNode } from "./rule-utils.js"

class RequireWhitespaceInsideTags extends BaseRuleVisitor {
  
  visitChildNodes(node: Node): void {
    this.checkWhitespace(node)
    super.visitChildNodes(node)
  }

  private checkWhitespace(node: Node): void {
    if (!isERBNode(node)) {
      return
    }
    const openTag = node.tag_opening
    const closeTag = node.tag_closing
    const content = node.content

    if (!openTag || !closeTag || !content) {
      return
    }

    const value = content.value

    this.checkOpenTagWhitespace(openTag, value)
    this.checkCloseTagWhitespace(closeTag, value)
  }

  private checkOpenTagWhitespace(openTag: Token, content:string):void {
    if (content.startsWith(" ")) {
      return 
    }
    this.messages.push({
      rule: this.ruleName,
      message: `Add whitespace after ${openTag.value}`,
      location: openTag.location,
      severity: "error"
    })
  }

  private checkCloseTagWhitespace(closeTag: Token, content:string):void {
    if (content.endsWith(" ")) {
      return
    }
    this.messages.push({
      rule: this.ruleName,
      message: `Add whitespace before ${closeTag.value}`,
      location: closeTag.location,
      severity: "error"
    })
  }
}

export class ERBRequireWhitespaceRule implements Rule {
  name = "erb-require-whitespace-inside-tags"
  check(node: Node): LintMessage[] {
    const visitor = new RequireWhitespaceInsideTags(this.name)
    visitor.visit(node)
    return visitor.messages
  }
}
