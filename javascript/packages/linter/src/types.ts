import { Node, Diagnostic } from "@herb-tools/core"
import type { defaultRules } from "./default-rules.js"

export type LintSeverity = "error" | "warning"

/**
 * Automatically inferred union type of all available linter rule names.
 * This type extracts the 'name' property from each rule class instance.
 */
export type LinterRule = InstanceType<typeof defaultRules[number]>['name']

export interface LintOffense extends Diagnostic {
  rule: LinterRule
  severity: LintSeverity
}

export interface LintResult {
  offenses: LintOffense[]
  errors: number
  warnings: number
}

export interface Rule {
  name: string
  check(node: Node): LintOffense[]
}

/**
 * Type representing a rule class constructor.
 * The Linter accepts rule classes rather than instances for better performance and memory usage.
 */
export type RuleClass = new () => Rule
