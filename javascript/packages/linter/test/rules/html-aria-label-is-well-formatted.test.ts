import { describe, test } from "vitest"
import { HTMLAriaLabelIsWellFormattedRule } from "../../src/rules/html-aria-label-is-well-formatted.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAriaLabelIsWellFormattedRule)

describe("html-aria-label-is-well-formatted", () => {
  test("passes for properly formatted aria-label", () => {
    expectNoOffenses(`<button aria-label="Close dialog">X</button>`)
  })

  test("passes for aria-label with proper sentence case", () => {
    expectNoOffenses(`<input aria-label="Search products" type="search">`)
  })

  test("fails for aria-label starting with lowercase", () => {
    expectError("The `aria-label` attribute value text should be formatted like visual text. Use sentence case (capitalize the first letter).")
    assertOffenses(`<button aria-label="close dialog">X</button>`)
  })

  test("fails for aria-label with line breaks", () => {
    expectError("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close\ndialog">X</button>`)
  })

  test("fails for aria-label with carriage return", () => {
    expectError("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close\rdialog">X</button>`)
  })

  test("fails for aria-label with HTML entity line breaks", () => {
    expectError("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
    assertOffenses(`<button aria-label="Close&#10;dialog">X</button>`)
  })

  test("fails for snake_case aria-label", () => {
    expectError("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`<button aria-label="close_dialog">X</button>`)
  })

  test("fails for kebab-case aria-label", () => {
    expectError("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
    assertOffenses(`<button aria-label="close-dialog">X</button>`)
  })

  test("fails for camelCase aria-label", () => {
    expectError("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
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
    expectError("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
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
