import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBCommentSyntax } from "../../src/rules/erb-comment-syntax.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBCommentSyntax)

describe("ERBCommentSyntax", () => {
  test("when the ERB comment syntax is correct", () => {
    expectNoOffenses(dedent`
      <%# good comment %>
    `)
  })

  test("when the ERB multi-line comment syntax is correct", () => {
    expectNoOffenses(dedent`
      <%
        # good comment
      %>
    `)
  })

  test("when the ERB multi-line comment syntax is correct with multiple comment lines", () => {
    expectNoOffenses(dedent`
      <%
        # good comment
        # good comment
      %>
    `)
  })

  test("when the ERB comment syntax is incorrect", () => {
    expectError("Use `<%#` instead of `<% #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <% # bad comment %>
    `)
  })

  test("when the ERB comment syntax is incorrect multiple times in one file", () => {
    expectError("Use `<%#` instead of `<% #`. Ruby comments immediately after ERB tags can cause parsing issues.")
    expectError("Use `<%#` instead of `<%= #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <% # first bad comment %>
      <%= # second bad comment %>
    `)
  })
})
