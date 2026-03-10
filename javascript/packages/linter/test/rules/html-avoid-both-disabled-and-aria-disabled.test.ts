import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAvoidBothDisabledAndAriaDisabledRule } from "../../src/rules/html-avoid-both-disabled-and-aria-disabled.js"

describe("html-avoid-both-disabled-and-aria-disabled", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for button with only disabled", () => {
    const html = '<button disabled>Click me</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for button with only aria-disabled", () => {
    const html = '<button aria-disabled="true">Click me</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for button with neither attribute", () => {
    const html = '<button>Click me</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for button with both disabled and aria-disabled", () => {
    const html = '<button disabled aria-disabled="true">Click me</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-avoid-both-disabled-and-aria-disabled")
    expect(lintResult.offenses[0].message).toBe("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
  })

  test("fails for input with both attributes", () => {
    const html = '<input type="text" disabled aria-disabled="false">'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-avoid-both-disabled-and-aria-disabled")
  })

  test("fails for textarea with both attributes", () => {
    const html = '<textarea disabled aria-disabled="true"></textarea>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for select with both attributes", () => {
    const html = '<select disabled aria-disabled="true"><option>Test</option></select>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for fieldset with both attributes", () => {
    const html = '<fieldset disabled aria-disabled="true"><input type="text"></fieldset>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for option with both attributes", () => {
    const html = '<option disabled aria-disabled="true">Test option</option>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for optgroup with both attributes", () => {
    const html = '<optgroup disabled aria-disabled="true" label="Test"><option>Test</option></optgroup>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("ignores elements that don't support disabled attribute", () => {
    const html = '<div disabled aria-disabled="true">Not a form element</div>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores anchor elements with both attributes", () => {
    const html = '<a href="#" disabled aria-disabled="true">Link</a>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case attribute names", () => {
    const html = '<button DISABLED ARIA-DISABLED="true">Mixed case</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles boolean disabled attribute", () => {
    const html = '<button disabled="disabled" aria-disabled="true">Boolean disabled</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles multiple form elements", () => {
    const html = `
      <button disabled>OK</button>
      <input type="text" disabled aria-disabled="true">
      <select aria-disabled="true"><option>Test</option></select>
      <textarea disabled aria-disabled="false"></textarea>
    `

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("passes when attributes have ERB content", () => {
    const html = '<button disabled="<%= is_disabled %>" aria-disabled="<%= aria_disabled %>">Dynamic</button>'

    const linter = new Linter(Herb, [HTMLAvoidBothDisabledAndAriaDisabledRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
