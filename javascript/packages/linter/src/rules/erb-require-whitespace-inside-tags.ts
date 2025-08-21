import type { ParseResult, Token, Node } from "@herb-tools/core"
import { isERBNode } from "@herb-tools/core";
import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

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

    if (openTag.value === "<%#") {
      this.checkCommentTagWhitespace(openTag, closeTag, value)
    } else {
      this.checkOpenTagWhitespace(openTag, value)
      this.checkCloseTagWhitespace(closeTag, value)
    }
  }

  private checkCommentTagWhitespace(openTag: Token, closeTag: Token, content: string): void {
    if (!content.startsWith(" ") && !content.startsWith("\n") && !content.startsWith("=")) {
      this.addOffense(
        `Add whitespace after \`${openTag.value}\`.`,
        openTag.location,
        "error"
      )
    } else if (content.startsWith("=") && content.length > 1 && !content[1].match(/\s/)) {
      this.addOffense(
        `Add whitespace after \`<%#=\`.`,
        openTag.location,
        "error"
      )
    }

    if (!content.endsWith(" ") && !content.endsWith("\n")) {
      this.addOffense(
        `Add whitespace before \`${closeTag.value}\`.`,
        closeTag.location,
        "error"
      )
    }
  }

  private checkOpenTagWhitespace(openTag: Token, content:string):void {
    if (content.startsWith(" ") || content.startsWith("\n")) {
      return
    }

    this.addOffense(
      `Add whitespace after \`${openTag.value}\`.`,
      openTag.location,
      "error"
    )
  }

  private checkCloseTagWhitespace(closeTag: Token, content:string):void {
    if (content.endsWith(" ") || content.endsWith("\n")) {
      return
    }

    this.addOffense(
      `Add whitespace before \`${closeTag.value}\`.`,
      closeTag.location,
      "error"
    )
  }
}

export class ERBRequireWhitespaceRule extends ParserRule {
  name = "erb-require-whitespace-inside-tags"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new RequireWhitespaceInsideTags(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
