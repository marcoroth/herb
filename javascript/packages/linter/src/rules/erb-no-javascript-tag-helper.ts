import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBNode, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, DocumentNode } from "@herb-tools/core"

const JAVASCRIPT_TAG_PATTERN = /\bjavascript_tag\b/

class ERBNoJavascriptTagHelperVisitor extends BaseRuleVisitor {
  visitDocumentNode(node: DocumentNode): void {
    for (const child of node.children || []) {
      if (!isERBNode(child)) continue
      if (!isERBOutputNode(child)) continue

      const content = child.content?.value || ""

      if (JAVASCRIPT_TAG_PATTERN.test(content)) {
        this.addOffense(
          "Avoid `javascript_tag`. Use inline `<script>` tags instead.",
          child.location,
        )
      }
    }

    super.visitDocumentNode(node)
  }
}

export class ERBNoJavascriptTagHelperRule extends ParserRule {
  static ruleName = "erb-no-javascript-tag-helper"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoJavascriptTagHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
