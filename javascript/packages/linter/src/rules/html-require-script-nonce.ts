import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, getAttribute, getStaticAttributeValue, hasAttributeValue, findAttributeByName, isERBOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

class RequireScriptNonceVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "script") {
      this.checkScriptNonce(node)
    }

    super.visitHTMLElementNode(node)
  }

  private checkScriptNonce(node: HTMLElementNode): void {
    if (!this.isJavaScriptTag(node)) return

    const nonceAttribute = this.findAttribute(node, "nonce")

    if (!nonceAttribute || !hasAttributeValue(nonceAttribute)) {
      this.addOffense(
        "Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.",
        node.tag_name!.location,
      )
    }
  }

  private isJavaScriptTag(node: HTMLElementNode): boolean {
    const typeAttribute = this.findAttribute(node, "type")
    if (!typeAttribute) return true

    const typeValue = getStaticAttributeValue(typeAttribute)
    if (typeValue === null) return true

    return typeValue === "text/javascript" || typeValue === "application/javascript"
  }

  private findAttribute(node: HTMLElementNode, name: string) {
    if (isERBOpenTagNode(node.open_tag)) {
      return findAttributeByName(node.open_tag.children, name)
    }

    return getAttribute(node, name)
  }
}

export class HTMLRequireScriptNonceRule extends ParserRule {
  static ruleName = "html-require-script-nonce"

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
    const visitor = new RequireScriptNonceVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
