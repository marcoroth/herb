import { describe, test } from "vitest"
import { HTMLNoAriaHiddenOnFocusableRule } from "../../src/rules/html-no-aria-hidden-on-focusable.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoAriaHiddenOnFocusableRule)

describe("html-no-aria-hidden-on-focusable", () => {
  test("passes for focusable element without aria-hidden", () => {
    expectNoOffenses(`<button>Click me</button>`)
  })

  test("passes for focusable element with aria-hidden='false'", () => {
    expectNoOffenses(`<button aria-hidden="false">Click me</button>`)
  })

  test("passes for non-focusable element with aria-hidden='true'", () => {
    expectNoOffenses(`<div aria-hidden="true">Hidden content</div>`)
  })

  test("fails for button with aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<button aria-hidden="true">Hidden button</button>`)
  })

  test("fails for input with aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<input type="text" aria-hidden="true">`)
  })

  test("fails for select with aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<select aria-hidden="true"><option>Test</option></select>`)
  })

  test("fails for textarea with aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<textarea aria-hidden="true"></textarea>`)
  })

  test("fails for anchor with href and aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<a href="/" aria-hidden="true">Link</a>`)
  })

  test("fails for summary with aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<details><summary aria-hidden="true">Details</summary><p>Content</p></details>`)
  })

  test("passes for anchor without href and aria-hidden='true'", () => {
    expectNoOffenses(`<a aria-hidden="true">Not a link</a>`)
  })

  test("fails for div with tabindex='0' and aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<div tabindex="0" aria-hidden="true">Focusable div</div>`)
  })

  test("passes for div with tabindex='-1' and aria-hidden='true'", () => {
    expectNoOffenses(`<div tabindex="-1" aria-hidden="true">Programmatically focusable div</div>`)
  })

  test("fails for span with tabindex='1' and aria-hidden='true'", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<span tabindex="1" aria-hidden="true">Focusable span</span>`)
  })

  test("passes for button with tabindex='-1' and aria-hidden='true'", () => {
    expectNoOffenses(`<button tabindex="-1" aria-hidden="true">Button removed from tab order</button>`)
  })

  test("handles mixed case attributes", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<button ARIA-HIDDEN="true">Hidden button</button>`)
  })

  test("handles mixed case element names", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`<BUTTON aria-hidden="true">Hidden button</BUTTON>`)
  })

  test("handles multiple elements", () => {
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    expectError("Elements that are focusable should not have `aria-hidden=\"true\"` because it will cause confusion for assistive technology users.")
    assertOffenses(`
      <button aria-hidden="true">Bad button</button>
      <div aria-hidden="true">OK div</div>
      <input type="text" aria-hidden="true">
      <div tabindex="0" aria-hidden="false">OK focusable div</div>
    `)
  })

  test("ignores aria-hidden with non-boolean values", () => {
    expectNoOffenses(`<button aria-hidden="maybe">Button</button>`)
  })

  test("passes for elements with ERB content in aria-hidden", () => {
    expectNoOffenses(`<button aria-hidden="<%= hidden_state %>">Dynamic button</button>`)
  })

  test("passes for elements with ERB content in tabindex", () => {
    expectNoOffenses(`<div tabindex="<%= tab_index %>" aria-hidden="true">Dynamic tabindex</div>`)
  })
})
