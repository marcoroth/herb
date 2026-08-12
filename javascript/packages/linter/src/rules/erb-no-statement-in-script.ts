import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import {
  getTagLocalName,
  getAttribute,
  getStaticAttributeValue,
  isERBNode,
  isERBOutputNode,
  isERBCommentNode,
  isHTMLOpenTagNode,
} from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, Node } from "@herb-tools/core"

const END_PATTERN = /^\s*end\b/

class ERBNoStatementInScriptVisitor extends BaseRuleVisitor {
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

    if (typeValue === "text/html") {
      return
    }

    if (!node.body || node.body.length === 0) {
      return
    }

    this.checkNodesForStatements(node.body)
  }

  private checkNodesForStatements(nodes: Node[]): void {
    for (const child of nodes) {
      if (!isERBNode(child)) continue
      if (isERBOutputNode(child)) continue
      if (isERBCommentNode(child)) continue

      const content = child.content?.value || ""

      if (END_PATTERN.test(content)) continue

      this.addOffense(
        "Avoid `<% %>` tags inside `<script>`. Use `<%= %>` to interpolate values into JavaScript.",
        child.location,
      )
    }
  }
}

export class ERBNoStatementInScriptRule extends ParserRule {
  static ruleName = "erb-no-statement-in-script"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoStatementInScriptVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
