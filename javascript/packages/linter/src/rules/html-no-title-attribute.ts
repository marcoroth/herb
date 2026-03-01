import { ParserRule } from "../types.js"
import { BaseRuleVisitor, getTagName, hasAttribute } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class NoTitleAttributeVisitor extends BaseRuleVisitor {
  ALLOWED_ELEMENTS_WITH_TITLE = new Set(["iframe", "link"])

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTitleAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTitleAttribute(node: HTMLOpenTagNode): void {
    const tagName = getTagName(node)

    if (!tagName || this.ALLOWED_ELEMENTS_WITH_TITLE.has(tagName)) {
      return
    }

    if (hasAttribute(node, "title")) {
      this.addOffense(
        "The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.",
        node.tag_name!.location,
      )
    }
  }
}

export class HTMLNoTitleAttributeRule extends ParserRule {
  name = "html-no-title-attribute"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoTitleAttributeVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
