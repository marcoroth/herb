import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoAriaHiddenOnFocusableRule } from "../../src/rules/html-no-aria-hidden-on-focusable.js"

describe("html-no-aria-hidden-on-focusable", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for focusable element without aria-hidden", () => {
    const html = '<button>Click me</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for focusable element with aria-hidden='false'", () => {
    const html = '<button aria-hidden="false">Click me</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for non-focusable element with aria-hidden='true'", () => {
    const html = '<div aria-hidden="true">Hidden content</div>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for button with aria-hidden='true'", () => {
    const html = '<button aria-hidden="true">Hidden button</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-aria-hidden-on-focusable")
    expect(lintResult.offenses[0].message).toBe("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
  })

  test("fails for input with aria-hidden='true'", () => {
    const html = '<input type="text" aria-hidden="true">'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-aria-hidden-on-focusable")
  })

  test("fails for select with aria-hidden='true'", () => {
    const html = '<select aria-hidden="true"><option>Test</option></select>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for textarea with aria-hidden='true'", () => {
    const html = '<textarea aria-hidden="true"></textarea>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for anchor with href and aria-hidden='true'", () => {
    const html = '<a href="/" aria-hidden="true">Link</a>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for summary with aria-hidden='true'", () => {
    const html = '<details><summary aria-hidden="true">Details</summary><p>Content</p></details>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("passes for anchor without href and aria-hidden='true'", () => {
    const html = '<a aria-hidden="true">Not a link</a>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for div with tabindex='0' and aria-hidden='true'", () => {
    const html = '<div tabindex="0" aria-hidden="true">Focusable div</div>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("passes for div with tabindex='-1' and aria-hidden='true'", () => {
    const html = '<div tabindex="-1" aria-hidden="true">Programmatically focusable div</div>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for span with tabindex='1' and aria-hidden='true'", () => {
    const html = '<span tabindex="1" aria-hidden="true">Focusable span</span>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("passes for button with tabindex='-1' and aria-hidden='true'", () => {
    const html = '<button tabindex="-1" aria-hidden="true">Button removed from tab order</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case attributes", () => {
    const html = '<button ARIA-HIDDEN="true">Hidden button</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles mixed case element names", () => {
    const html = '<BUTTON aria-hidden="true">Hidden button</BUTTON>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles multiple elements", () => {
    const html = `
      <button aria-hidden="true">Bad button</button>
      <div aria-hidden="true">OK div</div>
      <input type="text" aria-hidden="true">
      <div tabindex="0" aria-hidden="false">OK focusable div</div>
    `

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("ignores aria-hidden with non-boolean values", () => {
    const html = '<button aria-hidden="maybe">Button</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for elements with ERB content in aria-hidden", () => {
    const html = '<button aria-hidden="<%= hidden_state %>">Dynamic button</button>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for elements with ERB content in tabindex", () => {
    const html = '<div tabindex="<%= tab_index %>" aria-hidden="true">Dynamic tabindex</div>'

    const linter = new Linter(Herb, [HTMLNoAriaHiddenOnFocusableRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
