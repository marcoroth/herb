import { UJSAttributeVisitor } from "./ujs-base.js"
import { ParserRule } from "../types.js"

import type { UJSAttributeDescriptor } from "./ujs-base.js"
import type { ParseResult, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const DESCRIPTOR: UJSAttributeDescriptor = {
  attribute: "data-disable-with",
  dataKey: "disable_with",
  replacement: { attribute: "data-turbo-submits-with", option: "data: { turbo_submits_with: ... }" },
}

export class UJSPreferTurboSubmitsWithRule extends ParserRule {
  static ruleName = "ujs-prefer-turbo-submits-with"
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
