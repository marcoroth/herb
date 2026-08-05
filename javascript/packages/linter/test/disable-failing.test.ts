import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src/linter.js"
import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"
import { HTMLImgRequireAltRule } from "../src/rules/html-img-require-alt.js"
import { HTMLNoDuplicateAttributesRule } from "../src/rules/html-no-duplicate-attributes.js"
import { ParserNoErrorsRule } from "../src/rules/parser-no-errors.js"

import type { RuleClass } from "../src/types.js"

const PROTECTED_RULES = new Set(["parser-no-errors"])

function findFailingRules(ruleClasses: RuleClass[], source: string, fileName?: string) {
  const linter = new Linter(Herb, ruleClasses)
  const result = linter.lint(source, { fileName })
  const failingRules = new Map<string, number>()

  for (const offense of result.offenses) {
    if (PROTECTED_RULES.has(offense.rule)) continue
    if (offense.severity !== "error" && offense.severity !== "warning") continue

    failingRules.set(offense.rule, (failingRules.get(offense.rule) || 0) + 1)
  }

  return failingRules
}

describe("disable-failing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("identifies rules with offenses", () => {
    const failingRules = findFailingRules(
      [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule],
      '<DIV><img src="logo.png"></DIV>'
    )

    expect(failingRules.has("html-tag-name-lowercase")).toBe(true)
    expect(failingRules.has("html-img-require-alt")).toBe(true)
    expect(failingRules.get("html-tag-name-lowercase")).toBe(2)
    expect(failingRules.get("html-img-require-alt")).toBe(1)
  })

  test("returns empty map when no offenses", () => {
    const failingRules = findFailingRules(
      [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule],
      '<div><img src="logo.png" alt="Logo"></div>'
    )

    expect(failingRules.size).toBe(0)
  })

  test("only includes rules that have offenses", () => {
    const failingRules = findFailingRules(
      [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule, HTMLNoDuplicateAttributesRule],
      '<div><img src="logo.png"></div>'
    )

    expect(failingRules.has("html-img-require-alt")).toBe(true)
    expect(failingRules.has("html-tag-name-lowercase")).toBe(false)
    expect(failingRules.has("html-no-duplicate-attributes")).toBe(false)
  })

  test("parser-no-errors is excluded when source has parse errors", () => {
    const failingRules = findFailingRules(
      [ParserNoErrorsRule],
      '<div><span'
    )

    expect(failingRules.has("parser-no-errors")).toBe(false)
    expect(failingRules.size).toBe(0)
  })

  test("parser-no-errors is excluded but other rules still report", () => {
    const failingRules = findFailingRules(
      [HTMLImgRequireAltRule],
      '<img src="logo.png">'
    )

    expect(failingRules.has("html-img-require-alt")).toBe(true)
    expect(failingRules.has("parser-no-errors")).toBe(false)
  })
})
