import { ParserRule } from "../types.js"
import { BaseRuleVisitor, isKnownHTMLElement, isKnownSVGElement, isKnownMathMLElement, isCustomElement } from "./rule-utils.js"
import { getTagLocalName, isHTMLOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult, ParserOptions } from "@herb-tools/core"

const FOREIGN_CONTENT_TAGS = new Set(["svg", "math"])

function isComponentElement(node: HTMLElementNode): boolean {
  if (!isHTMLOpenTagNode(node.open_tag)) return false

  const rawTagName = node.open_tag.tag_name?.value
  if (!rawTagName) return false

  return /^[A-Z]/.test(rawTagName)
}

class NoUnknownTagVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (!tagName) {
      super.visitHTMLElementNode(node)
      return
    }

    if (FOREIGN_CONTENT_TAGS.has(tagName)) {
      return
    }

    if (isComponentElement(node)) {
      super.visitHTMLElementNode(node)
      return
    }

    if (!isCustomElement(tagName) && !isKnownHTMLElement(tagName) && !isKnownSVGElement(tagName) && !isKnownMathMLElement(tagName) && node.open_tag?.tag_name) {
      let message = `Unknown HTML tag \`<${tagName}>\`. This is not a standard HTML element.`

      if (tagName.includes("_")) {
        const suggestedName = tagName.replace(/_/g, "-")
        message += ` Did you mean \`<${suggestedName}>\`? Custom elements must contain a hyphen.`
      }

      this.addOffense(
        message,
        node.open_tag.tag_name.location,
      )
    }

    super.visitHTMLElementNode(node)
  }
}

export class HTMLNoUnknownTagRule extends ParserRule {
  static ruleName = "html-no-unknown-tag"
  static introducedIn = this.version("0.9.3")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
      exclude: ["**/*.xml.erb"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
      dot_notation_tags: true
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoUnknownTagVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
