import { BaseRuleVisitor, getTagName, hasAttribute, getAttribute, getStaticAttributeValue } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class AnchorRequireHrefVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkATag(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkATag(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "a") {
      return
    }

    if (hasAttribute(node, "name") && !hasAttribute(node, "href")) {
      return
    }

    const hrefAttr = getAttribute(node, "href")

    if (!hrefAttr) {
      this.addOffense(
        "Links should go somewhere, you probably want to use a `<button>` instead.",
        node.tag_name!.location,
      )
      return
    }

    const hrefValue = getStaticAttributeValue(hrefAttr)

    if (hrefValue === "#") {
      this.addOffense(
        "Links should go somewhere, you probably want to use a `<button>` instead.",
        node.tag_name!.location,
      )
    }
  }
}

export class HTMLAnchorRequireHrefRule extends ParserRule {
  name = "html-anchor-require-href"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AnchorRequireHrefVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
