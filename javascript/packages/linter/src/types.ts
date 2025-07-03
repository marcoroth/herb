import { Location, Node } from "@herb-tools/core"

export interface LintOffense {
  rule: string
  message: string
  location: Location
  severity: "error" | "warning"
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
