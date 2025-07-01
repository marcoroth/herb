import { ERBNoOutputControlFlow } from "./rules/erb-no-output-control-flow.js"
import { HTMLTagNameLowercaseRule } from "./rules/html-tag-name-lowercase.js"
import { HTMLNoDuplicateAttributesRule } from "./rules/html-no-duplicate-attributes.js"
import { HTMLImgRequireAltRule } from "./rules/html-img-require-alt.js"
import { HTMLAttributeValuesRequireQuotesRule } from "./rules/html-attribute-values-require-quotes.js"
import { HTMLNoNestedLinksRule } from "./rules/html-no-nested-links.js"
import { HTMLAttributeDoubleQuotesRule } from "./rules/html-attribute-double-quotes.js"
import { HTMLBooleanAttributesNoValueRule } from "./rules/html-boolean-attributes-no-value.js"
import { HTMLNoBlockInsideInlineRule } from "./rules/html-no-block-inside-inline.js"

import type { RuleClass, LintResult, LintMessage } from "./types.js"
import type { DocumentNode } from "@herb-tools/core"

export class Linter {
  private rules: RuleClass[]
  private messages: LintMessage[]

  /**
   * Creates a new Linter instance.
   * @param rules - Array of rule classes (not instances) to use. If not provided, uses default rules.
   */
  constructor(rules?: RuleClass[]) {
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.messages = []
  }

  /**
   * Returns the default set of rule classes used by the linter.
   * @returns Array of rule classes
   */
  private getDefaultRules(): RuleClass[] {
    return [
      ERBNoOutputControlFlow,
      HTMLTagNameLowercaseRule,
      HTMLNoDuplicateAttributesRule,
      HTMLImgRequireAltRule,
      HTMLAttributeValuesRequireQuotesRule,
      HTMLNoNestedLinksRule,
      HTMLAttributeDoubleQuotesRule,
      HTMLBooleanAttributesNoValueRule,
      HTMLNoBlockInsideInlineRule
    ]
  }

  getRuleCount(): number {
    return this.rules.length
  }

  lint(document: DocumentNode): LintResult {
    this.messages = []

    for (const Rule of this.rules) {
      const rule = new Rule()
      const ruleMessages = rule.check(document)

      this.messages.push(...ruleMessages)
    }

    const errors = this.messages.filter(message => message.severity === "error").length
    const warnings = this.messages.filter(message => message.severity === "warning").length

    return {
      messages: this.messages,
      errors,
      warnings
    }
  }
}
