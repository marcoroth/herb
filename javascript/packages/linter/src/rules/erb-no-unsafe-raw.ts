import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"
import { PrismVisitor, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBContentNode, PrismNode } from "@herb-tools/core"

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

class UnsafeRawCallDetector extends PrismVisitor {
  public hasRawCall = false
  public hasHtmlSafeCall = false

  visitCallNode(node: PrismNode): void {
    if (node.name === "raw" && !node.receiver) {
      this.hasRawCall = true
    }

    if (node.name === "html_safe") {
      this.hasHtmlSafeCall = true
    }

    this.visitChildNodes(node)
  }
}

class ERBNoUnsafeRawVisitor extends ElementStackVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (this.isInsideElement(...RAW_TEXT_ELEMENTS)) return
    if (!isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const detector = new UnsafeRawCallDetector()
    detector.visit(prismNode)

    if (detector.hasRawCall) {
      this.addOffense(
        "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        node.location,
      )
    }

    if (detector.hasHtmlSafeCall) {
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

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnsafeRawVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
