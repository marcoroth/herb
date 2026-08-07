import { describe, test, expect } from "vitest"
import { Location } from "@herb-tools/core"

import { fixabilityFor } from "../src/fixability.js"

import type { BaseAutofixContext, LintOffense, RuleClass } from "../src/types.js"

function offense(autofixContext?: BaseAutofixContext): LintOffense {
  return {
    rule: "test-rule",
    code: "test-rule",
    source: "Herb Linter",
    message: "message",
    location: Location.zero,
    severity: "warning",
    autofixContext,
  } as LintOffense
}

function ruleClass(properties: Partial<RuleClass>): RuleClass {
  return { ruleName: "test-rule", ...properties } as RuleClass
}

const context = { node: { type: "AST_HTML_ELEMENT_NODE" } } as unknown as BaseAutofixContext

describe("fixabilityFor", () => {
  test("offenses of rules that are not autocorrectable are not fixable", () => {
    expect(fixabilityFor(offense(), ruleClass({}))).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
  })

  test("offenses of autocorrectable rules are fixable without an autofix context", () => {
    expect(fixabilityFor(offense(), ruleClass({ autocorrectable: true }))).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
  })

  test("offenses without an autofix context are not fixable when the rule requires one", () => {
    const rule = ruleClass({ autocorrectable: true, autofixRequiresContext: true })

    expect(fixabilityFor(offense(), rule)).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    expect(fixabilityFor(offense(context), rule)).toEqual({ autocorrectable: true, unsafeAutocorrectable: false })
  })

  test("offenses without an autofix context are not unsafely fixable when the rule requires one", () => {
    const rule = ruleClass({ unsafeAutocorrectable: true, autofixRequiresContext: true })

    expect(fixabilityFor(offense(), rule)).toEqual({ autocorrectable: false, unsafeAutocorrectable: false })
    expect(fixabilityFor(offense(context), rule)).toEqual({ autocorrectable: false, unsafeAutocorrectable: true })
  })
})
