import type { Project } from "stimulus-parser"
import type { LintContext } from "@herb-tools/linter"
import { DEFAULT_LINT_CONTEXT } from "@herb-tools/linter"

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
  ...DEFAULT_LINT_CONTEXT,
  stimulusProject: undefined
} as const
