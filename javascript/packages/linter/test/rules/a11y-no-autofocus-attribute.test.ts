import { describe, test } from "vitest"
import { A11yNoAutofocusAttributeRule } from "../../src/rules/a11y-no-autofocus-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import dedent from "dedent"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAutofocusAttributeRule)

describe("a11y-no-autofocus-attribute", () => {
  describe("HTML attributes", () => {
    test("passes for element without autofocus", () => {
      expectNoOffenses(`<input type="text">`)
    })

    test("passes for textarea without autofocus", () => {
      expectNoOffenses(dedent`
        <textarea></textarea>
      `)
    })

    test("fails for input with autofocus", () => {
      expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <input type="text" autofocus>
      `)
    })

    test("fails for input with autofocus=\"autofocus\"", () => {
      expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <input type="password" autofocus="autofocus">
      `)
    })

    test("fails for select with autofocus", () => {
      expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <select autofocus><option>A</option></select>
      `)
    })

    test("fails for autofocus with ERB dynamic value", () => {
      expectWarning("Avoid using the `autofocus` attribute. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <input type="text" autofocus="<%= autofocus? %>">
      `)
    })
  })

  describe("Action View Form Tag Helpers", () => {
    test("passes for text_field_tag without autofocus", () => {
      expectNoOffenses(`<%= text_field_tag :name, "value" %>`)
    })

    test("passes for text_area_tag without autofocus", () => {
      expectNoOffenses(`<%= text_area_tag :body, "content" %>`)
    })

    test("fails for text_field_tag with autofocus", () => {
      expectWarning("Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <%= text_field_tag :name, "value", autofocus: true %>
      `)
    })

    test("fails for text_area_tag with autofocus", () => {
      expectWarning("Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <%= text_area_tag :body, "content", autofocus: true %>
      `)
    })

    test("ignores non-matching methods", () => {
      expectNoOffenses(`<%= some_other_helper :name, autofocus: true %>`)
    })
  })

  describe("Action View Form Builder", () => {
    test("passes for text_field without autofocus", () => {
      expectNoOffenses(`<%= f.text_field :name %>`)
    })

    test("passes for text_area without autofocus", () => {
      expectNoOffenses(`<%= f.text_area :body %>`)
    })

    test("fails for text_field with autofocus", () => {
      expectWarning("Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <%= f.text_field :name, autofocus: true %>
      `)
    })

    test("fails for text_area with autofocus", () => {
      expectWarning("Avoid using the `autofocus` option in form helpers. It reduces accessibility by moving users to an element without warning and context.")

      assertOffenses(dedent`
        <%= f.text_area :body, autofocus: true %>
      `)
    })

    test("ignores non-matching form builder methods", () => {
      expectNoOffenses(`<%= f.select :country, autofocus: true %>`)
    })
  })
})
