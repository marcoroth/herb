import { UJSAttributeVisitor } from "./ujs-base.js"
import { ParserRule } from "../types.js"

import { helperNamesForTags } from "../utils/action-view-utils.js"

import type { UJSAttributeDescriptor } from "./ujs-base.js"
import type { ParseResult, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const METHOD_OPTION_HELPERS = helperNamesForTags("a")

const DESCRIPTOR: UJSAttributeDescriptor = {
  attribute: "data-method",
  dataKey: "method",
  replacement: { attribute: "data-turbo-method", option: "data: { turbo_method: ... }" },
  keyword: { name: "method", helpers: METHOD_OPTION_HELPERS },
}

export class UJSPreferTurboMethodRule extends ParserRule {
  static ruleName = "ujs-prefer-turbo-method"
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
