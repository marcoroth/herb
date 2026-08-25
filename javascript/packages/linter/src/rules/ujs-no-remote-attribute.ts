import { UJSAttributeVisitor } from "./ujs-base.js"
import { ParserRule } from "../types.js"

import { helperNamesForTags } from "../utils/action-view-utils.js"

import type { UJSAttributeDescriptor } from "./ujs-base.js"
import type { ParseResult, ParserOptions } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const REMOTE_OPTION_HELPERS = helperNamesForTags("a", "form")

const DESCRIPTOR: UJSAttributeDescriptor = {
  attribute: "data-remote",
  dataKey: "remote",
  replacement: null,
  keyword: { name: "remote", helpers: REMOTE_OPTION_HELPERS },
}

export class UJSNoRemoteAttributeRule extends ParserRule {
  static ruleName = "ujs-no-remote-attribute"
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
