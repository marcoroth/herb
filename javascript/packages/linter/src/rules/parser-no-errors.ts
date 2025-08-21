import { ParserRule } from "../types.js"

import type { LintOffense } from "../types.js"
import type { ParseResult, HerbError } from "@herb-tools/core"

export class ParserNoErrorsRule extends ParserRule {
  name = "parser-no-errors"

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
      rule: this.name,
      code: this.name,
      source: "linter"
    }
  }
}
