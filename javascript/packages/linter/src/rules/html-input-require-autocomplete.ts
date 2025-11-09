import { getTagName } from "@herb-tools/core"
import { BaseRuleVisitor, getAttribute, getAttributeValue, getStaticAttributeValueContent } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLOpenTagNode } from "@herb-tools/core"

class HTMLInputRequireAutocompleteVisitor extends BaseRuleVisitor {
  readonly HTML_INPUT_TYPES_REQUIRING_AUTOCOMPLETE = new Set([
    "color",
    "date",
    "datetime-local",
    "email",
    "month",
    "number",
    "password",
    "range",
    "search",
    "tel",
    "text",
    "time",
    "url",
    "week",
  ])

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkInputTag(node)
  }

  private checkInputTag(node: HTMLOpenTagNode): void {
    if (!this.isInputTag(node) || this.hasAutocomplete(node)) return

    const typeAttribute = getAttribute(node, "type");
    if (!typeAttribute) return

    const typeValue = getStaticAttributeValueContent(typeAttribute)
    if (!typeValue) return

    if (!this.HTML_INPUT_TYPES_REQUIRING_AUTOCOMPLETE.has(typeValue)) return

    this.addOffense(
      "Add an `autocomplete` attribute to improve form accessibility. Use a specific value (e.g., `autocomplete=\"email\"`), `autocomplete=\"on\"` for defaults, or `autocomplete=\"off\"` to disable.",
      node.location
    )
  }

  private hasAutocomplete(node: HTMLOpenTagNode) {
    const autocompleteAttribute = getAttribute(node, "autocomplete");
    if (!autocompleteAttribute) return false

    const autocompleteValue = getAttributeValue(autocompleteAttribute)
    if (!autocompleteValue) return false

    return true
  }

  private isInputTag(node: HTMLOpenTagNode) {
    const tagName = getTagName(node);

    if (tagName === "input") {
      return true
    } else {
      return false
    }
  }
}

export class HTMLInputRequireAutocompleteRule extends ParserRule {
  name = "html-input-require-autocomplete"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLInputRequireAutocompleteVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
