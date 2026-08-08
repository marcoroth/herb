import { ElementStackVisitor } from "./rule-utils.js"
import { getTagLocalName, isHTMLOpenTagNode } from "@herb-tools/core"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, Location, ParseResult, ParserOptions } from "@herb-tools/core"

class NestedLinkVisitor extends ElementStackVisitor {
  private linkDepth = 0

  private checkNestedLink(location: Location): boolean {
    if (this.linkDepth > 0) {
      this.addOffense(
        "Nested `<a>` elements are not allowed. Links cannot contain other links.",
        location,
      )

      return true
    }

    const verdict = this.isRenderedInsideElement("a")

    if (verdict === "always") {
      this.addOffenseWithCallChain(
        "Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element.",
        location,
      )

      return true
    }

    if (verdict === "mixed") {
      this.addOffenseWithCallChain(
        "Nested `<a>` elements are not allowed. At least one call site renders this file inside an `<a>` element.",
        location,
        this.renderedChainInside("a"),
      )

      return true
    }

    return false
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) !== "a") {
      super.visitHTMLElementNode(node)
      return
    }

    this.checkNestedLink(this.elementLocation(node))

    this.linkDepth++
    super.visitHTMLElementNode(node)
    this.linkDepth--
  }

  // Handle self-closing <a> tags (though they're not valid HTML, they might exist)
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    const tagName = getTagLocalName(node)

    if (tagName === "a" && node.is_void) {
      this.checkNestedLink(node.tag_name!.location)
    }

    super.visitHTMLOpenTagNode(node)
  }

  private elementLocation(node: HTMLElementNode): Location {
    if (isHTMLOpenTagNode(node.open_tag) && node.open_tag.tag_name) {
      return node.open_tag.tag_name.location
    }

    return node.location
  }
}

export class HTMLNoNestedLinksRule extends ParserRule {
  static ruleName = "html-no-nested-links"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NestedLinkVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
