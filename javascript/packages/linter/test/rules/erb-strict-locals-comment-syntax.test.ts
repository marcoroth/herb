import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBStrictLocalsCommentSyntaxRule } from "../../src/rules/erb-strict-locals-comment-syntax.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBStrictLocalsCommentSyntaxRule)

describe("ERBStrictLocalsCommentSyntaxRule", () => {
  test("allows valid strict locals comments", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, admin: false) %>
      <p><%= user.name %></p>

      <%# locals: (title:) %>
      <h1><%= title %></h1>
    `)
  })

  test("ignores non-locals comments", () => {
    expectNoOffenses(dedent`
      <%# just a regular comment %>
    `)
  })

  test("flags malformed strict locals comments", () => {
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")
    expectError("Strict locals comments must use `locals: (name:, option: default)` syntax.")

    assertOffenses(dedent`
      <%# locals() %>
      <%# local: (user:) %>
      <%# locals (user:) %>
      <%# locals: user %>
      <%# locals: %>
      <%# locals: (user: %>
    `)
  })
})
