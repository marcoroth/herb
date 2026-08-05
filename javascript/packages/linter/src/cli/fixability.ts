import type { LintOffense, RuleClass } from "../types.js"

export interface Fixability {
  autocorrectable: boolean
  unsafeAutocorrectable: boolean
}

const NOT_FIXABLE: Fixability = { autocorrectable: false, unsafeAutocorrectable: false }

export function fixabilityFor(offense: LintOffense, ruleClass: RuleClass | undefined): Fixability {
  if (!ruleClass) return NOT_FIXABLE
  if (ruleClass.autofixRequiresContext === true && !offense.autofixContext) return NOT_FIXABLE

  const correctable = ruleClass.autocorrectable === true
  const unsafe = ruleClass.unsafeAutocorrectable === true || offense.autofixContext?.unsafe === true

  if (!correctable && !unsafe) return NOT_FIXABLE

  return { autocorrectable: correctable && !unsafe, unsafeAutocorrectable: unsafe }
}
