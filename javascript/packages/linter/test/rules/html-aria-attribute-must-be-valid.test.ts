import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaAttributeMustBeValid } from "../../src/rules/html-aria-attribute-must-be-valid.js"

describe("html-aria-attribute-must-be-valid", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("allows a div with a valid aria attribute", () => {
    const html = '<div aria-label="Section Title"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("ignores non-aria attributes", () => {
    const html = '<div class="foo"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("fails when a div has an invalid aria attribute", () => {
    const html = '<div aria-bogus="foo"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-bogus` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for mistyped aria name", () => {
    const html = '<input type="text" aria-lable="Search" />'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-lable` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for aria-", () => {
    const html = '<input type="text" aria-="Search" />'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })
})
