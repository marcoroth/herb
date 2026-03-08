import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoOutputInAttributePositionRule } from "../../src/rules/erb-no-output-in-attribute-position.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoOutputInAttributePositionRule)

const MESSAGE = "Avoid `<%= %>` in attribute position. Use `<% if ... %>` with static attributes instead."

describe("ERBNoOutputInAttributePositionRule", () => {
  describe("not allowed", () => {
    test("ERB output tag in attribute position", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= data_attributes %>></div>
      `)
    })

    test("ERB raw output tag in attribute position", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%== raw_attributes %>></div>
      `)
    })

    test("multiple ERB output tags in attribute position", () => {
      expectError(MESSAGE)
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= first_attrs %> <%= second_attrs %>></div>
      `)
    })
  })

  describe("allowed", () => {
    test("static attributes", () => {
      expectNoOffenses(dedent`
        <div class="container" id="main"></div>
        <img src="/logo.png" alt="Logo">
        <input type="text" name="field">
      `)
    })

    test("ERB output in attribute values", () => {
      expectNoOffenses(dedent`
        <div class="<%= css_class %>"></div>
        <input value="<%= user.name %>">
        <a href="<%= path %>">Link</a>
      `)
    })

    test("ERB control flow in attribute position", () => {
      expectNoOffenses(dedent`
        <div <% if active? %>class="active"<% end %>></div>
        <input <% unless disabled %>enabled<% end %>>
      `)
    })
  })
})
