import type { Location, Node, Diagnostic } from "@herb-tools/core"

export interface LintMessage extends Diagnostic {

}

export interface LintResult {
  messages: LintMessage[]
  errors: number
  warnings: number
}

export interface Rule {
  name: string
  check(node: Node): LintMessage[]
}

/**
 * Type representing a rule class constructor.
 * The Linter accepts rule classes rather than instances for better performance and memory usage.
 */
export type RuleClass = new () => Rule
