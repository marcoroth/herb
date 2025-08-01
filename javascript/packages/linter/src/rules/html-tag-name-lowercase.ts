import { BaseRuleVisitor } from "./rule-utils.js"

import type { ParserRule, LintOffense } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

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

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkTagName(node)
    this.visitChildNodes(node)
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): void {
    const tagName = node.tag_name?.value

    if (!tagName) return

    const lowercaseTagName = tagName.toLowerCase()

    if (tagName !== lowercaseTagName) {
      let type: string = node.type

      if (node.type == "AST_HTML_OPEN_TAG_NODE") type = "Opening"
      if (node.type == "AST_HTML_CLOSE_TAG_NODE") type = "Closing"
      if (node.type == "AST_HTML_SELF_CLOSE_TAG_NODE") type = "Self-closing"

      this.addOffense(
        `${type} tag name \`${tagName}\` should be lowercase. Use \`${lowercaseTagName}\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTagNameLowercaseRule implements ParserRule {
  name = "html-tag-name-lowercase"

  check(node: Node): LintOffense[] {
    const visitor = new TagNameLowercaseVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
