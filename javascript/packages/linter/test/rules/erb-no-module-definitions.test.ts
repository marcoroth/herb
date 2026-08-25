import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoModuleDefinitionsRule } from "../../src/rules/erb-no-module-definitions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  ERBNoModuleDefinitionsRule,
)

const MESSAGE =
  "Avoid defining modules in ERB templates. Move the module to a helper, library, or another appropriate Ruby file."

describe("erb-no-module-definitions", () => {
  test("passes for a module reference", () => {
    expectNoOffenses(`<%= DisplayHelpers.highlight(post.title) %>`)
  })

  test("passes for other module constructors", () => {
    expectNoOffenses(`<% decorator = SomeModule.new %>`)
  })

  test("passes for the word module in a string or comment", () => {
    expectNoOffenses(dedent`
      <%# module DisplayHelpers %>
      <%= "module DisplayHelpers" %>
    `)
  })

  test("passes for class definitions", () => {
    expectNoOffenses(`<% class DisplayHelper; end %>`)
  })

  test("reports a module definition", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses(`<% module DisplayHelpers; end %>`)
  })

  test("reports Module.new", () => {
    expectError(MESSAGE, [1, 15])

    assertOffenses(`<% decorator = Module.new %>`)
  })

  test("reports the module keyword rather than the entire definition", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses(`<% module Admin::DisplayHelpers; end %>`)
  })

  test("reports a multiline module definition", () => {
    expectError(MESSAGE, [2, 2])

    assertOffenses(dedent`
      <%
        module DisplayHelpers
          def item_count(count)
            pluralize(count, "item")
          end
        end
      %>
    `)
  })

  test("reports each nested module definition", () => {
    expectError(MESSAGE, [1, 3])
    expectError(MESSAGE, [1, 17])

    assertOffenses(`<% module Admin; module DisplayHelpers; end; end %>`)
  })
})
