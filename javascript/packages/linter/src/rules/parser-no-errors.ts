import { ParserRule } from "../types.js"

import type { LintOffense, FullRuleConfig } from "../types.js"
import type { ParseResult, HerbError } from "@herb-tools/core"

export class ParserNoErrorsRule extends ParserRule {
  static ruleName = "parser-no-errors"
  static introducedIn = this.version("0.5.0")

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

  protected herbErrorToLintOffense(error: HerbError): LintOffense {
    return {
      ...super.herbErrorToLintOffense(error),
      message: `${error.message} (\`${error.type}\`)`,
    }
  }
}
