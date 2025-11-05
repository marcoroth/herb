import { BaseRuleVisitor, getTagName } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, ParseResult } from "@herb-tools/core"

class NestedLinkVisitor extends BaseRuleVisitor {
  private linkStack: HTMLOpenTagNode[] = []

  private checkNestedLink(openTag: HTMLOpenTagNode): boolean {
    if (this.linkStack.length > 0) {
      this.addOffense(
        "Nested `<a>` elements are not allowed. Links cannot contain other links.",
        openTag.tag_name!.location,
      )

      return true
    }

    return false
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!node.open_tag || node.open_tag.type !== "AST_HTML_OPEN_TAG_NODE") {
      super.visitHTMLElementNode(node)
      return
    }

    const openTag = node.open_tag as HTMLOpenTagNode
    const tagName = getTagName(openTag)

    if (tagName !== "a") {
      super.visitHTMLElementNode(node)
      return
    }

    // If we're already inside a link, this is a nested link
    this.checkNestedLink(openTag)

    this.linkStack.push(openTag)
    super.visitHTMLElementNode(node)
    this.linkStack.pop()
  }

  // Handle self-closing <a> tags (though they're not valid HTML, they might exist)
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName === "a" && node.is_void) {
      this.checkNestedLink(node)
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export class HTMLNoNestedLinksRule extends ParserRule {
  name = "html-no-nested-links"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NestedLinkVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
