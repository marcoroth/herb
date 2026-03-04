import { ParserRule } from "../types.js"

import type { LintOffense, FullRuleConfig } from "../types.js"
import type { ParseResult, HerbError } from "@herb-tools/core"

export class ParserNoErrorsRule extends ParserRule {
  static ruleName = "parser-no-errors"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult): LintOffense[] {
    return result.recursiveErrors().map(error =>
      this.herbErrorToLintOffense(error)
    )
  }

  private herbErrorToLintOffense(error: HerbError): LintOffense {
    return {
      message: `${error.message} (\`${error.type}\`)`,
      location: error.location,
      severity: error.severity,
      rule: this.ruleName,
      code: this.ruleName,
      source: "linter"
    }
  }
}
