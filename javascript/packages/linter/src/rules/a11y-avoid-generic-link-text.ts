import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, hasAttribute, isHTMLTextNode, isLiteralNode, isERBOutputNode } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult, ParserOptions, Node } from "@herb-tools/core"

const BANNED_GENERIC_TEXT = [
  "read more",
  "learn more",
  "click here",
  "more",
  "link",
  "here",
]

function stripText(text: string): string {
  return text.toLowerCase().replace(/\W+/g, " ").trim()
}

function isBannedText(text: string): boolean {
  return BANNED_GENERIC_TEXT.includes(stripText(text))
}

class AvoidGenericLinkTextVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkLinkElement(node)
    super.visitHTMLElementNode(node)
  }

  private checkLinkElement(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)

    if (tagName !== "a") {
      return
    }

    if (hasAttribute(node, "aria-labelledby")) {
      return
    }

    if (hasAttribute(node, "aria-label")) {
      return
    }

    const textContent = this.getStaticTextContent(node)

    if (textContent === null) {
      return
    }

    if (isBannedText(textContent)) {
      this.addOffense(
        `Avoid using generic link text such as "${textContent.trim()}". Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context.`,
        node.location,
      )
    }
  }

  private getStaticTextContent(node: HTMLElementNode): string | null {
    if (!node.body || node.body.length === 0) {
      return ""
    }

    return this.collectStaticText(node.body)
  }

  private collectStaticText(nodes: Node[]): string | null {
    let text = ""

    for (const child of nodes) {
      if (isHTMLTextNode(child) || isLiteralNode(child)) {
        text += child.content
      } else if (isERBOutputNode(child)) {
        return null
      } else {
        return null
      }
    }

    return text
  }
}

export class A11yAvoidGenericLinkTextRule extends ParserRule {
  static ruleName = "a11y-avoid-generic-link-text"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new AvoidGenericLinkTextVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
