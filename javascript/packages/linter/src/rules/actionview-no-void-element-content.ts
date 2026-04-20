import { ParserRule } from "../types.js"

import type { LintOffense, FullRuleConfig } from "../types.js"
import type { ParseResult, ParserOptions } from "@herb-tools/core"

export class ActionViewNoVoidElementContentRule extends ParserRule {
  static ruleName = "actionview-no-void-element-content"
  static introducedIn = this.version("0.9.3")
  static consumesParserErrors = true

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

  check(result: ParseResult): LintOffense[] {
    return result.recursiveErrors()
      .filter(error => error.type === "VOID_ELEMENT_CONTENT_ERROR")
      .map(error => this.herbErrorToLintOffense(error))
  }
}
