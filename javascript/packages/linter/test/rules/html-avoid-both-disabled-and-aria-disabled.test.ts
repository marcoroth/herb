import { describe, test } from "vitest"
import { HTMLAvoidBothDisabledAndAriaDisabledRule } from "../../src/rules/html-avoid-both-disabled-and-aria-disabled.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAvoidBothDisabledAndAriaDisabledRule)

describe("html-avoid-both-disabled-and-aria-disabled", () => {
  test("passes for button with only disabled", () => {
    expectNoOffenses(`<button disabled>Click me</button>`)
  })

  test("passes for button with only aria-disabled", () => {
    expectNoOffenses(`<button aria-disabled="true">Click me</button>`)
  })

  test("passes for button with neither attribute", () => {
    expectNoOffenses(`<button>Click me</button>`)
  })

  test("fails for button with both disabled and aria-disabled", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<button disabled aria-disabled="true">Click me</button>`)
  })

  test("fails for input with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<input type="text" disabled aria-disabled="false">`)
  })

  test("fails for textarea with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<textarea disabled aria-disabled="true"></textarea>`)
  })

  test("fails for select with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<select disabled aria-disabled="true"><option>Test</option></select>`)
  })

  test("fails for fieldset with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<fieldset disabled aria-disabled="true"><input type="text"></fieldset>`)
  })

  test("fails for option with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<option disabled aria-disabled="true">Test option</option>`)
  })

  test("fails for optgroup with both attributes", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<optgroup disabled aria-disabled="true" label="Test"><option>Test</option></optgroup>`)
  })

  test("ignores elements that don't support disabled attribute", () => {
    expectNoOffenses(`<div disabled aria-disabled="true">Not a form element</div>`)
  })

  test("ignores anchor elements with both attributes", () => {
    expectNoOffenses(`<a href="#" disabled aria-disabled="true">Link</a>`)
  })

  test("handles mixed case attribute names", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<button DISABLED ARIA-DISABLED="true">Mixed case</button>`)
  })

  test("handles boolean disabled attribute", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`<button disabled="disabled" aria-disabled="true">Boolean disabled</button>`)
  })

  test("handles multiple form elements", () => {
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    expectError("aria-disabled may be used in place of native HTML disabled to allow tab-focus on an otherwise ignored element. Setting both attributes is contradictory and confusing. Choose either disabled or aria-disabled, not both.")
    assertOffenses(`
      <button disabled>OK</button>
      <input type="text" disabled aria-disabled="true">
      <select aria-disabled="true"><option>Test</option></select>
      <textarea disabled aria-disabled="false"></textarea>
    `)
  })

  test("passes when attributes have ERB content", () => {
    expectNoOffenses(`<button disabled="<%= is_disabled %>" aria-disabled="<%= aria_disabled %>">Dynamic</button>`)
  })
})
