import { BaseRuleVisitor } from "./rule-utils.js"

import type { Rule, LintOffense } from "../types.js"
import type { HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

class TagNameLowercaseVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagName(node)
    this.visitChildNodes(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.checkTagName(node)
    this.visitChildNodes(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkTagName(node)
    this.visitChildNodes(node)
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): void {
    const tagName = node.tag_name?.value
    if (!tagName) return

    if (tagName !== tagName.toLowerCase()) {
      let type: string = node.type

      if (node.type == "AST_HTML_OPEN_TAG_NODE") type = "Opening"
      if (node.type == "AST_HTML_CLOSE_TAG_NODE") type = "Closing"
      if (node.type == "AST_HTML_SELF_CLOSE_TAG_NODE") type = "Self-closing"

      this.addOffense(
        `${type} tag name \`${tagName}\` should be lowercase. Use \`${tagName.toLowerCase()}\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTagNameLowercaseRule implements Rule {
  name = "html-tag-name-lowercase"

  check(node: Node): LintOffense[] {
    const visitor = new TagNameLowercaseVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
