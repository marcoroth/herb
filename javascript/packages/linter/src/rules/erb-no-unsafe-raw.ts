import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"
import { PrismVisitor, isERBOutputNode, locationFromByteOffset } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, ERBContentNode, PrismNode, Location } from "@herb-tools/core"

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

class UnsafeRawCallCollector extends PrismVisitor {
  public readonly rawCalls: PrismNode[] = []
  public readonly htmlSafeCalls: PrismNode[] = []

  override visit(node: PrismNode): void {
    if (!node) return

    super.visit(node)
  }

  visitCallNode(node: PrismNode): void {
    if (node.name === "raw" && !node.receiver) {
      this.rawCalls.push(node)
    }

    if (node.name === "html_safe") {
      this.htmlSafeCalls.push(node)
    }

    this.visitChildNodes(node)
  }
}

class ERBNoUnsafeRawVisitor extends ElementStackVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (this.isInsideElement(...RAW_TEXT_ELEMENTS)) return
    if (!isERBOutputNode(node)) return

    const prismNode = node.prismNode
    const source = node.source
    if (!prismNode || !source) return

    const collector = new UnsafeRawCallCollector()
    collector.visit(prismNode)

    for (const call of collector.rawCalls) {
      this.addOffense(
        "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        this.callLocation(source, call, node.location),
      )
    }

    for (const call of collector.htmlSafeCalls) {
      this.addOffense(
        "Avoid `.html_safe` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities.",
        this.htmlSafeLocation(source, call, node.location),
      )
    }
  }

  private callLocation(source: string, node: PrismNode, fallback: Location): Location {
    const location = node.location
    if (!location) return fallback

    return locationFromByteOffset(source, location.startOffset, location.length)
  }

  private htmlSafeLocation(source: string, node: PrismNode, fallback: Location): Location {
    const operatorLocation = node.callOperatorLoc
    const messageLocation = node.messageLoc

    if (operatorLocation && messageLocation) {
      const startOffset = operatorLocation.startOffset
      const length = messageLocation.startOffset + messageLocation.length - startOffset

      return locationFromByteOffset(source, startOffset, length)
    }

    if (messageLocation) {
      return locationFromByteOffset(source, messageLocation.startOffset, messageLocation.length)
    }

    return this.callLocation(source, node, fallback)
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
