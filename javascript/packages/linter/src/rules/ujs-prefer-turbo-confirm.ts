import { UJSAttributeVisitor } from "./ujs-base.js"
import { ParserRule } from "../types.js"

import type { UJSAttributeDescriptor } from "./ujs-base.js"
import type { ParseResult, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const DESCRIPTOR: UJSAttributeDescriptor = {
  attribute: "data-confirm",
  dataKey: "confirm",
  replacement: { attribute: "data-turbo-confirm", option: "data: { turbo_confirm: ... }" },
}

export class UJSPreferTurboConfirmRule extends ParserRule {
  static ruleName = "ujs-prefer-turbo-confirm"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new UJSAttributeVisitor(DESCRIPTOR, this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
