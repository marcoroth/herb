import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { PrismVisitor } from "@herb-tools/core"

import {
  getTagLocalName,
  getAttribute,
  getStaticAttributeValue,
  isERBNode,
  isERBOutputNode,
  isHTMLOpenTagNode,
} from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, Node, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

const SAFE_METHOD_NAMES = new Set([
  "to_json",
  "json_escape",
])

const ESCAPE_JAVASCRIPT_METHOD_NAMES = new Set([
  "j",
  "escape_javascript",
])

class SafeCallDetector extends PrismVisitor {
  public hasSafeCall = false
  public hasEscapeJavascriptCall = false

  visitCallNode(node: PrismNode): void {
    if (SAFE_METHOD_NAMES.has(node.name)) {
      this.hasSafeCall = true
    }

    if (ESCAPE_JAVASCRIPT_METHOD_NAMES.has(node.name)) {
      this.hasEscapeJavascriptCall = true
    }

    this.visitChildNodes(node)
  }
}

class ERBNoUnsafeScriptInterpolationVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) {
      super.visitHTMLElementNode(node)
      return
    }

    if (getTagLocalName(node.open_tag) === "script") {
      this.checkScriptElement(node)
    }

    super.visitHTMLElementNode(node)
  }

  private checkScriptElement(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) return

    const typeAttribute = getAttribute(node.open_tag, "type")
    const typeValue = typeAttribute ? getStaticAttributeValue(typeAttribute) : null

    if (typeValue === "text/html") return
    if (!node.body || node.body.length === 0) return

    this.checkNodesForUnsafeOutput(node.body)
  }

  private checkNodesForUnsafeOutput(nodes: Node[]): void {
    for (const child of nodes) {
      if (!isERBNode(child)) continue
      if (!isERBOutputNode(child)) continue

      const erbContent = child as ERBContentNode
      const prismNode = erbContent.prismNode
      const detector = new SafeCallDetector()

      if (prismNode) detector.visit(prismNode)
      if (detector.hasSafeCall) continue

      if (detector.hasEscapeJavascriptCall) {
        this.addOffense(
          "Avoid `j()` / `escape_javascript()` in `<script>` tags. It is only safe inside quoted string literals. Use `.to_json` instead, which is safe in any position.",
          child.location,
        )

        continue
      }

      this.addOffense(
        "Unsafe ERB output in `<script>` tag. Use `.to_json` to safely serialize values into JavaScript.",
        child.location,
      )
    }
  }
}

export class ERBNoUnsafeScriptInterpolationRule extends ParserRule {
  static ruleName = "erb-no-unsafe-script-interpolation"
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
    const visitor = new ERBNoUnsafeScriptInterpolationVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
