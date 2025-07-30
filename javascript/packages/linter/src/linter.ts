import { defaultRules } from "./default-rules.js"

import type { RuleClass, LintResult, LintOffense } from "./types.js"
import type { DocumentNode } from "@herb-tools/core"

export class Linter {
  private rules: RuleClass[]
  private offenses: LintOffense[]

  /**
   * Creates a new Linter instance.
   * @param rules - Array of rule classes (not instances) to use. If not provided, uses default rules.
   */
  constructor(rules?: RuleClass[]) {
    this.rules = rules !== undefined ? rules : this.getDefaultRules()
    this.offenses = []
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
    this.offenses = []

    for (const Rule of this.rules) {
      const rule = new Rule()
      const ruleOffenses = rule.check(document)

      this.offenses.push(...ruleOffenses)
    }

    const errors = this.offenses.filter(offense => offense.severity === "error").length
    const warnings = this.offenses.filter(offense => offense.severity === "warning").length

    return {
      offenses: this.offenses,
      errors,
      warnings
    }
  }
}
