import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOutputNode, getTagLocalName, isHTMLOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, HTMLElementNode } from "@herb-tools/core"

const RAW_PATTERN = /\braw[\s(]/
const HTML_SAFE_PATTERN = /\.html_safe\b/

const RAW_TEXT_ELEMENTS = new Set([
  "title",
  "textarea",
  "script",
  "style",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "listing",
  "plaintext",
])

class ERBNoUnsafeRawVisitor extends BaseRuleVisitor {
  private insideRawTextElement = false

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) {
      super.visitHTMLElementNode(node)
      return
    }

    const tagName = getTagLocalName(node.open_tag)

    if (tagName && RAW_TEXT_ELEMENTS.has(tagName)) {
      const wasInside = this.insideRawTextElement
      this.insideRawTextElement = true
      super.visitHTMLElementNode(node)
      this.insideRawTextElement = wasInside
      return
    }

    super.visitHTMLElementNode(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (this.insideRawTextElement) return
    if (!isERBOutputNode(node)) return

    const content = node.content?.value || ""

    if (RAW_PATTERN.test(content)) {
      this.addOffense(
        "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        node.location,
      )
    }

    if (HTML_SAFE_PATTERN.test(content)) {
      this.addOffense(
        "Avoid `.html_safe` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        node.location,
      )
    }
  }
}

export class ERBNoUnsafeRawRule extends ParserRule {
  static ruleName = "erb-no-unsafe-raw"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnsafeRawVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
