import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HTMLInputRequireAutocompleteRule } from "../../src/rules/html-input-require-autocomplete.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLInputRequireAutocompleteRule)

describe("HTMLInputRequireAutocompleteRule", () => {
  test("when autocomplete is present on input types", () => {
    expectNoOffenses(dedent`
      <input type="email" autocomplete="foo">
    `)
  })

  test("when input type does not require autocomplete attribute and it is not present", () => {
    expectNoOffenses(dedent`
      <input type="bar">
    `)
  })

  test("when input type requires autocomplete attribute and it is not present", () => {
    expectError("`<input>` tag is missing an `autocomplete` attribute. If no autocomplete behavior is desired, use `autocomplete=off`.")

    assertOffenses(dedent`
      <input type="email">
    `)
  })

  describe.todo("Action View Helpers", () => {
    const formHelpersRequiringAutocomplete = [
      'date_field_tag',
      'color_field_tag',
      'email_field_tag',
      'text_field_tag',
      'utf8_enforcer_tag',
      'month_field_tag',
      'number_field_tag',
      'password_field_tag',
      'search_field_tag',
      'telephone_field_tag',
      'time_field_tag',
      'url_field_tag',
      'week_field_tag',
    ]

    formHelpersRequiringAutocomplete.forEach(formHelper => {
      test(`usage of "${formHelper}" helper with autocomplete value`, () => {
        expectNoOffenses(dedent`
          <%= text_field_tag 'foo', autocomplete: 'foo' %>
        `)
      })

      test(`usage of "${formHelper}" helper without autocomplete value`, () => {
        expectError("`<input>` tag is missing an `autocomplete` attribute. If no autocomplete behavior is desired, use `autocomplete=off`.")

        expectNoOffenses(dedent`
          <%= ${formHelper} 'foo' autocomplete: 'foo' %>
        `)
      })
    })
  })
})
