import { Visitor } from "@herb-tools/core"

import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"

import type { Rule, LintResult, LintMessage } from "./types.js"
import type { DocumentNode, HTMLOpenTagNode, HTMLCloseTagNode, HTMLSelfCloseTagNode } from "@herb-tools/core"

export class Linter extends Visitor {
  private rules: Rule[]
  private messages: LintMessage[]

  constructor(rules?: Rule[]) {
    super()
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.messages = []
  }

  private getDefaultRules(): Rule[] {
    return [
      new HTMLTagNameLowercaseRule(),
      new HTMLNoDuplicateAttributesRule(),
      new HTMLImgRequireAltRule(),
      new HTMLAttributeValuesRequireQuotesRule(),
      new HTMLNoNestedLinksRule(),
      new HTMLAttributeDoubleQuotesRule(),
      new HTMLBooleanAttributesNoValueRule()
    ]
  }

  lint(document: DocumentNode): LintResult {
    this.messages = []

    this.visit(document)

    for (const rule of this.rules) {
      if (rule instanceof HTMLNoNestedLinksRule) {
        const ruleMessages = rule.check(document)
        this.messages.push(...ruleMessages)
      }
    }

    const errors = this.messages.filter(message => message.severity === "error").length
    const warnings = this.messages.filter(message => message.severity === "warning").length

    return {
      messages: this.messages,
      errors,
      warnings
    }
  }

  private checkNode(node: HTMLOpenTagNode | HTMLCloseTagNode | HTMLSelfCloseTagNode): void {
    for (const rule of this.rules) {

      // Skip rules that handle their own traversal
      if (rule instanceof HTMLNoNestedLinksRule) {
        continue
      }

      const ruleMessages = rule.check(node)
      this.messages.push(...ruleMessages)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkNode(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.checkNode(node)
    super.visitHTMLCloseTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkNode(node)
    super.visitHTMLSelfCloseTagNode(node)
  }
}
