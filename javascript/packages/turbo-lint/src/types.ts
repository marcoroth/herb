import type { Herb } from "@herb-tools/node-wasm"
import type { ParseResult, Location, Diagnostic } from "@herb-tools/core"

export type HerbType = typeof Herb

export type LintSeverity = "error" | "warning" | "info" | "hint"

export interface LintContext {
  fileName?: string
}

export interface LintOffense extends Diagnostic {
  rule: string
  severity: LintSeverity
}

export interface LintResult {
  offenses: LintOffense[]
  errors: number
  warnings: number
}

export interface LinterConfig {
  rules?: Record<string, any>
}

export abstract class ParserRule {
  abstract name: string
  abstract check(result: ParseResult, context?: Partial<LintContext>): LintOffense[]
}

export type RuleClass = new () => ParserRule