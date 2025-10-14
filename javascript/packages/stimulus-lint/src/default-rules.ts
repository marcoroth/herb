import { StimulusDataControllerValidRule } from "./rules/stimulus-data-controller-valid.js"
import { StimulusDataActionValidRule } from "./rules/stimulus-data-action-valid.js"
import { StimulusDataTargetValidRule } from "./rules/stimulus-data-target-valid.js"
import { StimulusDataValueValidRule } from "./rules/stimulus-data-value-valid.js"
import { StimulusAttributeFormatRule } from "./rules/stimulus-attribute-format.js"

import type { RuleClass } from "./types.js"

/**
 * Default set of Stimulus linting rules
 */
export const defaultRules: RuleClass[] = [
  StimulusDataControllerValidRule,
  StimulusDataActionValidRule,
  StimulusDataTargetValidRule,
  StimulusDataValueValidRule,
  StimulusAttributeFormatRule
]
