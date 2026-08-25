import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoMethodDefinitionsRule } from "../../src/rules/erb-no-method-definitions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  ERBNoMethodDefinitionsRule,
)
const methodDefinitionMessage = (name: string): string =>
  `Avoid defining methods in ERB templates. Move \`${name}\` to a helper, presenter, or view component.`
const DEFINE_METHOD_MESSAGE =
  "Avoid defining methods in ERB templates. Move this `define_method` call to a helper, presenter, or view component."

describe("ERBNoMethodDefinitionsRule", () => {
  test("passes without method definitions", () => {
    expectNoOffenses(dedent`
      <% formatted_date = date.strftime("%B %d") %>
      <p><%= formatted_date %></p>
    `)
  })

  test("ignores lambdas", () => {
    expectNoOffenses(dedent`
      <% format_date = ->(date) { date.strftime("%B %d") } %>
      <p><%= format_date.call(Date.today) %></p>
    `)
  })

  test("ignores strings and comments", () => {
    expectNoOffenses(dedent`
      <%# def format_date(date) %>
      <p><%= "def format_date(date); define_method(:format_date)" %></p>
    `)
  })

  test("reports a method definition across ERB tags at the def keyword", () => {
    expectError(
      methodDefinitionMessage("format_date"),
      [1, 3],
    )

    assertOffenses(dedent`
      <% def format_date(date) %>
        <%= date.strftime("%B %d") %>
      <% end %>
    `)
  })

  test("reports an endless method definition", () => {
    expectError(methodDefinitionMessage("format_date"))

    assertOffenses('<% def format_date(date) = date.strftime("%B %d") %>')
  })

  test("reports a singleton method definition", () => {
    expectError(methodDefinitionMessage("format_date"))

    assertOffenses(dedent`
      <% def self.format_date(date) %>
        date.strftime("%B %d")
      <% end %>
    `)
  })

  test("reports define_method calls at the call name", () => {
    expectError(DEFINE_METHOD_MESSAGE, [1, 3])

    assertOffenses(dedent`
      <% define_method(:format_date) { |date| date.strftime("%B %d") } %>
    `)
  })

  test("reports qualified define_method calls", () => {
    expectError(DEFINE_METHOD_MESSAGE, [1, 14])

    assertOffenses(
      '<% self.class.define_method(:format_date) { |date| date.strftime("%B %d") } %>',
    )
  })

  test("reports every method definition", () => {
    expectError(methodDefinitionMessage("format_date"))
    expectError(methodDefinitionMessage("admin?"))

    assertOffenses(dedent`
      <% def format_date(date) %>
        date.strftime("%B %d")
      <% end %>

      <% def admin? %>
        current_user.admin?
      <% end %>
    `)
  })
})
