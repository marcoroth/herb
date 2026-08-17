import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoReturnRule } from "../../src/rules/erb-no-return.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } =
  createLinterTest(ERBNoReturnRule)

const MESSAGE =
  "Avoid using `return` in ERB templates. Use a conditional or move the logic to a controller or component."

describe("ERBNoReturnRule", () => {
  test("ignores conditionals", () => {
    expectNoOffenses(dedent`
      <% if condition? %>
        <p>Content</p>
      <% end %>
    `)
  })

  test("ignores comments", () => {
    expectNoOffenses("<%# return unless condition? %>")
  })

  test("ignores strings", () => {
    expectNoOffenses('<%= "return unless condition?" %>')
  })

  test("ignores method names", () => {
    expectNoOffenses("<%= returning(record) { |value| value } %>")
  })

  test("fails for a return with a value", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses('<% return "" unless condition? %>')
  })

  test("fails for a bare return", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses("<% return %>")
  })

  test("fails when content follows return", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses(dedent`
      <% return "" unless condition? %>
      <p>Content</p>
    `)
  })

  test("fails for every nested return", () => {
    expectError(MESSAGE, [3, 4])
    expectError(MESSAGE, [5, 4])

    assertOffenses(dedent`
      <%
        if condition?
          return "first"
        else
          return "second"
        end
      %>
    `)
  })
})
