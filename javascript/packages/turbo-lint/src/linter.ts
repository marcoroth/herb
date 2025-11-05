import { defaultRules } from "./default-rules.js"

import type { RuleClass, LintResult, LintContext, LintOffense } from "./types.js"
import type { HerbBackend, ParseResult } from "@herb-tools/core"

export class TurboLinter {
  private herb: HerbBackend
  private rules: RuleClass[]

  /**
   * Creates a new TurboLinter instance.
   * @param herb - The Herb backend instance for parsing HTML
   * @param rules - Array of rule classes to use
   */
  constructor(herb: HerbBackend, rules: RuleClass[] = defaultRules) {
    this.herb = herb
    this.rules = rules
  }

  /**
   * Lint source code with Turbo-specific context
   * @param source - The source code to lint (HTML template)
   * @param context - Optional context for linting
   */
  lint(source: string, context?: Partial<LintContext>): LintResult {
    const parseResult = this.herb.parse(source) as ParseResult

    const allOffenses: LintOffense[] = []

    // Instantiate and run each rule
    for (const RuleConstructor of this.rules) {
      const rule = new RuleConstructor()
      const offenses = rule.check(parseResult, context)
      allOffenses.push(...offenses)
    }

    // Count offense severities
    const errors = allOffenses.filter(o => o.severity === "error").length
    const warnings = allOffenses.filter(o => o.severity === "warning").length

    return {
      offenses: allOffenses,
      errors,
      warnings
    }
  }

  /**
   * Get the number of rules loaded in the linter
   */
  getRuleCount(): number {
    return this.rules.length
  }

  /**
   * Lint an HTML file
   */
  async lintFile(filePath: string): Promise<LintResult> {
    const fs = await import("fs")
    const source = fs.readFileSync(filePath, "utf-8")

    const context: Partial<LintContext> = {
      fileName: filePath
    }

    return this.lint(source, context)
  }
}
