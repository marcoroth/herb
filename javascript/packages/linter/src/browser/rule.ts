import { DEFAULT_RULE_CONFIG } from "../types.js"

import { Location } from "@herb-tools/core"

import type { DOMNodeLike } from "./dom-to-ast.js"
import type { UnboundLintOffense, LintContext, LintSeverity, FullRuleConfig, RuleVersion } from "../types.js"

export abstract class BrowserRule {
  static type = "browser" as const
  static ruleName: string
  static introducedIn: RuleVersion
  static autocorrectable = false

  get ruleName(): string {
    return (this.constructor as typeof BrowserRule).ruleName
  }

  get defaultConfig(): FullRuleConfig {
    return { ...DEFAULT_RULE_CONFIG, environments: ["browser"] }
  }

  protected createOffense(message: string, severity?: LintSeverity): UnboundLintOffense {
    return {
      rule: this.ruleName,
      code: this.ruleName,
      source: "Herb Linter",
      message,
      location: Location.fromOptional(null),
      severity,
    }
  }

  abstract check(root: DOMNodeLike, context?: Partial<LintContext>): UnboundLintOffense[]
}

export type BrowserRuleClass = (new () => BrowserRule) & typeof BrowserRule
