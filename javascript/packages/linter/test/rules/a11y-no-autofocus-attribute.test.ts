import { describe, test } from "vitest"
import { A11yNoAutofocusAttributeRule } from "../../src/rules/a11y-no-autofocus-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAutofocusAttributeRule)

describe("a11y-no-autofocus-attribute", () => {
  test("passes for element without autofocus", () => {
    expectNoOffenses(`<input type="text">`)
  })

  test("passes for element without autofocus and other attributes", () => {
    expectNoOffenses(`<input type="text" name="email" placeholder="Enter email">`)
  })

  test("passes for textarea without autofocus", () => {
    expectNoOffenses(`<textarea></textarea>`)
  })

  test("passes for select without autofocus", () => {
    expectNoOffenses(`<select><option>A</option></select>`)
  })

  test("fails for input with autofocus (boolean)", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<input type="text" autofocus>`)
  })

  test("fails for input with autofocus=\"autofocus\"", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<input type="password" autofocus="autofocus">`)
  })

  test("fails for textarea with autofocus", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<textarea autofocus></textarea>`)
  })

  test("fails for button with autofocus", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<button autofocus>Click</button>`)
  })

  test("fails for select with autofocus", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<select autofocus><option>A</option></select>`)
  })

  test("fails for div with autofocus", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<div autofocus>Content</div>`)
  })

  test("handles multiple elements with autofocus", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`
      <input type="text" autofocus>
      <textarea autofocus></textarea>
    `)
  })

  test("fails for autofocus with ERB dynamic value", () => {
    expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")
    assertOffenses(`<input type="text" autofocus="<%= should_autofocus? %>">`)
  })
})
