import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoUnderscoresInAttributeNamesRule } from "../../src"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoUnderscoresInAttributeNamesRule)

describe("html-no-underscores-in-attribute-names", () => {
  test("passes for valid attribute names (hyphens, letters, digits, colon)", () => {
    expectNoOffenses(dedent`
      <div data-user-id="123" aria-label="Close"></div>
      <input data123-value="ok">
    `)
  })

  test("fails for attribute names with underscores", () => {
    expectWarning("Attribute `data_user_id` should not contain underscores. Use hyphens (-) instead.")
    expectWarning("Attribute `aria_label` should not contain underscores. Use hyphens (-) instead.")
    expectWarning("Attribute `custom_attr` should not contain underscores. Use hyphens (-) instead.")

    assertOffenses(dedent`
      <div data_user_id="123"></div>
      <img aria_label="Close">
      <custom-element custom_attr="x"></custom-element>
    `)
  })

  test("does not flag dynamic attribute names", () => {
    expectNoOffenses(dedent`
      <div data-<%=  %>="value"></div>
      <div <%= dynamic_name %>="value"></div>
      <div data-<%= key %>-test="value"></div>
    `)
  })

  test("fails for dynamic attribute names with underscores", () => {
    expectWarning("Attribute `data_<%= key %>` should not contain underscores. Use hyphens (-) instead.")
    expectWarning("Attribute `data_<%= key %>-test` should not contain underscores. Use hyphens (-) instead.")
    expectWarning("Attribute `data-<%= key %>_test` should not contain underscores. Use hyphens (-) instead.")

    assertOffenses(dedent`
      <div data_<%= key %>="value"></div>
      <div data_<%= key %>-test="value"></div>
      <div data-<%= key %>_test="value"></div>
    `)
  })

  test("handles malformed attributes without crashing (issue #601)", () => {
    expectWarning("Attribute `foo_bar` should not contain underscores. Use hyphens (-) instead.")

    assertOffenses(dedent`
      <input foo_bar=I18n.t('value')>
    `)
  })

  test("handles malformed attributes without crashing - exact snippet from issue #601", () => {
    expectWarning("Attribute `t('foo_bar')` should not contain underscores. Use hyphens (-) instead.")

    assertOffenses(dedent`
      <input title=I18n.t('foo_bar')>
    `)
  })
})
