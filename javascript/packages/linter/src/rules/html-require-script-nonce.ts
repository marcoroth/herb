import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { getTagLocalName, getAttribute, getStaticAttributeValue, hasAttributeValue, findAttributeByName, isERBOpenTagNode, HELPER_REGISTRY, HELPER_BY_SOURCE } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"

const HELPERS_WITH_CSP_NONCE_SUPPORT = [
  HELPER_REGISTRY["javascript_include_tag"].source,
  HELPER_REGISTRY["javascript_tag"].source,
]

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

      return
    }

    this.checkLiteralNonceOnTagHelper(node, nonceAttribute)
  }

  private checkLiteralNonceOnTagHelper(node: HTMLElementNode, nonceAttribute: HTMLAttributeNode): void {
    if (!node.element_source) return
    if (HELPERS_WITH_CSP_NONCE_SUPPORT.includes(node.element_source)) return

    const nonceValue = getStaticAttributeValue(nonceAttribute)

    if (nonceValue === "true" || nonceValue === "false") {
      this.addOffense(
        `\`nonce: ${nonceValue}\` on \`${this.helperName(node)}\` outputs a literal \`nonce="${nonceValue}"\` attribute, which will not match the Content Security Policy header and the browser will block the script. Only \`javascript_tag\` and \`javascript_include_tag\` resolve \`nonce: true\` to the per-request \`content_security_policy_nonce\`. Use \`javascript_tag\` with \`nonce: true\` instead.`,
        nonceAttribute.name!.location,
        undefined,
        "error",
      )
    }
  }

  private helperName(node: HTMLElementNode): string {
    if (!node.element_source) return "unknown"

    const helper = HELPER_BY_SOURCE[node.element_source]

    if (!helper) return node.element_source

    if (helper.name === "tag") {
      return `tag.${node.tag_name?.value ?? "script"}`
    }

    return helper.name
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
  static introducedIn = this.version("0.9.3")

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
