import { defaultRules } from "./default-rules.js"
import type { RuleClass, LintResult, LintOffense } from "./types.js"
import type { DocumentNode } from "@herb-tools/core"

export class Linter {
  private rules: RuleClass[]
  private messages: LintOffense[]

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
    return defaultRules
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
