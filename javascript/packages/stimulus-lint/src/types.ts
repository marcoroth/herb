import type { Project } from "stimulus-parser"
import type { LintContext } from "@herb-tools/linter"

export * from "@herb-tools/linter"

/**
 * Stimulus controller definition interface
 */
export interface StimulusControllerDefinition {
  guessedIdentifier: string
  actionNames: string[]
  targetNames: string[]
  values: Array<{
    name: string
    type: string
    default?: any
  }>
  classNames?: string[]
  hasErrors?: boolean
}

export interface StimulusLintContext extends LintContext {
  stimulusProject?: Project
}

export const DEFAULT_STIMULUS_LINT_CONTEXT: StimulusLintContext = {
  fileName: undefined,
  stimulusProject: undefined
} as const
