import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import {
  getTagLocalName,
  getAttribute,
  getStaticAttributeValue,
  isERBNode,
  isERBOutputNode,
  isHTMLOpenTagNode,
} from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, Node } from "@herb-tools/core"

const SAFE_PATTERN = /\.to_json\b/

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

      const content = child.content?.value?.trim() || ""

      if (SAFE_PATTERN.test(content)) continue

      this.addOffense(
        "Unsafe ERB output in `<script>` tag. Use `.to_json` to safely serialize values into JavaScript.",
        child.location,
      )
    }
  }
}

export class ERBNoUnsafeScriptInterpolationRule extends ParserRule {
  static ruleName = "erb-no-unsafe-script-interpolation"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnsafeScriptInterpolationVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
