import { BaseRuleVisitor } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode, ParseResult } from "@herb-tools/core"

class TagNameLowercaseVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = node.tag_name?.value

    if (node.open_tag) {
      this.checkTagName(node.open_tag as HTMLOpenTagNode)
    }

    if (tagName && ["svg"].includes(tagName.toLowerCase())) {
      if (node.close_tag) {
        this.checkTagName(node.close_tag as HTMLCloseTagNode)
      }

      return
    }

    this.visitChildNodes(node)

    if (node.close_tag) {
      this.checkTagName(node.close_tag as HTMLCloseTagNode)
    }
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode): void {
    const tagName = node.tag_name?.value

    if (!tagName) return

    const lowercaseTagName = tagName.toLowerCase()

    if (tagName !== lowercaseTagName) {
      let type: string = node.type

      if (node.type == "AST_HTML_OPEN_TAG_NODE") type = "Opening"
      if (node.type == "AST_HTML_CLOSE_TAG_NODE") type = "Closing"

      this.addOffense(
        `${type} tag name \`${tagName}\` should be lowercase. Use \`${lowercaseTagName}\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTagNameLowercaseRule extends ParserRule {
  name = "html-tag-name-lowercase"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new TagNameLowercaseVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
