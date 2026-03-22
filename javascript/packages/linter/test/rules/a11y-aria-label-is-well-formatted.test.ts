import { describe, test } from "vitest"
import { A11yAriaLabelIsWellFormattedRule } from "../../src/rules/a11y-aria-label-is-well-formatted.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yAriaLabelIsWellFormattedRule)

describe("a11y-aria-label-is-well-formatted", () => {
  test("passes for properly formatted aria-label", () => {
    expectNoOffenses(`<button aria-label="Close dialog">X</button>`)
  })

  test("passes for aria-label with proper sentence case", () => {
    expectNoOffenses(`<input aria-label="Search products" type="search">`)
  })

  test("fails for aria-label starting with lowercase", () => {
    expectWarning("The `aria-label` attribute value text should be formatted like visual text. Use sentence case (capitalize the first letter).")
    assertOffenses(`<button aria-label="close dialog">X</button>`)
  })

  test("fails for aria-label with line breaks", () => {
    expectWarning("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close\ndialog">X</button>`)
  })

  test("fails for aria-label with carriage return", () => {
    expectWarning("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close\rdialog">X</button>`)
  })

  test("fails for aria-label with HTML entity line breaks", () => {
    expectWarning("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close&#10;dialog">X</button>`)
  })

  test("fails for snake_case aria-label", () => {
    expectWarning("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`<button aria-label="close_dialog">X</button>`)
  })

  test("fails for kebab-case aria-label", () => {
    expectWarning("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`<button aria-label="close-dialog">X</button>`)
  })

  test("fails for camelCase aria-label", () => {
    expectWarning("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`<button aria-label="closeDialog">X</button>`)
  })

  test("passes for aria-label with spaces and proper formatting", () => {
    expectNoOffenses(`<button aria-label="Close the dialog">X</button>`)
  })

  test("passes for aria-label with numbers", () => {
    expectNoOffenses(`<button aria-label="Page 2 of 10">2</button>`)
  })

  test("ignores other attributes", () => {
    expectNoOffenses(`<button aria-labelledby="close_dialog_label">X</button>`)
  })

  test("handles multiple elements", () => {
    expectWarning("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`
      <button aria-label="Close dialog">X</button>
      <input aria-label="search_field" type="text">
    `)
  })

  test("passes for aria-label with ERB content", () => {
    expectNoOffenses(`<button aria-label="<%= action_label %>">Action</button>`)
  })

  test("passes for mixed case attribute name", () => {
    expectNoOffenses(`<button ARIA-LABEL="Close dialog">X</button>`)
  })
})
