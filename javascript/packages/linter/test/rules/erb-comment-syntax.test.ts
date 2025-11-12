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

  test("when herb:disable is used with incorrect ERB syntax", () => {
    expectError("Use `<%#` instead of `<% #` for `herb:disable` directives. Herb directives only work with ERB comment syntax (`<%# ... %>`).")

    assertOffenses(dedent`
      <DIV></DIV><% # herb:disable html-tag-name-lowercase %>
    `)
  })

  test("when herb:disable all is used with incorrect ERB syntax", () => {
    expectError("Use `<%#` instead of `<% #` for `herb:disable` directives. Herb directives only work with ERB comment syntax (`<%# ... %>`).")

    assertOffenses(dedent`
      <DIV></DIV><% # herb:disable all %>
    `)
  })

  test("when herb:disable is used with incorrect ERB output syntax", () => {
    expectError("Use `<%#` instead of `<%= #` for `herb:disable` directives. Herb directives only work with ERB comment syntax (`<%# ... %>`).")

    assertOffenses(dedent`
      <DIV></DIV><%= # herb:disable html-tag-name-lowercase %>
    `)
  })

  test("when herb:disable has extra whitespace with incorrect syntax", () => {
    expectError("Use `<%#` instead of `<% #` for `herb:disable` directives. Herb directives only work with ERB comment syntax (`<%# ... %>`).")

    assertOffenses(dedent`
      <DIV></DIV><%  #  herb:disable html-tag-name-lowercase %>
    `)
  })

  test("when ERB escaped output tag is used with incorrect syntax", () => {
    expectError("Use `<%#` instead of `<%== #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <%== # escaped output comment %>
    `)
  })

  test("when ERB tag has multiple spaces before #", () => {
    expectError("Use `<%#` instead of `<%= #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <%=   # comment with multiple spaces %>
    `)
  })

  test("when ERB trim tag is used with incorrect syntax", () => {
    expectError("Use `<%#` instead of `<%- #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <%-  # trim tag comment %>
    `)
  })

  test("when ERB tag has many spaces before #", () => {
    expectError("Use `<%#` instead of `<% #`. Ruby comments immediately after ERB tags can cause parsing issues.")

    assertOffenses(dedent`
      <%    # comment with many spaces %>
    `)
  })
})
